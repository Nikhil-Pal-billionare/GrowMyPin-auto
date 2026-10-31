// Shared helpers for the signup funnel, Diwali offer, visitor tracking, admin panel
// and push messages. Not a route (lives outside /api).

import fs from "fs";
import path from "path";
import { getUser, db } from "./app.js";

// ---------------- small utils ----------------
export function lower(s) {
  return String(s || "").trim().toLowerCase();
}

export function superEmail() {
  return lower(process.env.SUPER_ADMIN_EMAIL);
}

// Owner-only Pin Studio preview, for while the Pinterest API is not approved yet.
// True only when the page asks for it (app.html?preview=1 sends header x-gmp-preview: 1)
// AND the logged-in GrowMyPin account is SUPER_ADMIN_EMAIL. Other admins and users never get it.
export function isOwnerPreview(req) {
  if (String((req.headers && req.headers["x-gmp-preview"]) || "") !== "1") return false;
  const u = getUser(req);
  const sup = superEmail();
  return !!(u && u.email && sup && lower(u.email) === sup);
}

// "Complete your profile": 4 steps, 25% each. Used by the menu ring and the profile page.
// Pinterest counts as done with a profile link or a connected account (pin_stats is saved on connect).
export function profileSteps(p) {
  const pr = p || {};
  const links = pr.shop_links || {};
  const steps = [
    { k: "store", t: "Add your store link", ok: Object.keys(links).some(function (x) { return !!links[x]; }) },
    { k: "pinterest", t: "Add your Pinterest", ok: !!pr.pinterest_url || !!pr.pin_stats },
    { k: "niche", t: "Tell us what you sell", ok: !!pr.niche },
    { k: "goal", t: "Set your monthly sales goal", ok: (Number(pr.target_sales) || 0) > 0 }
  ];
  const done = steps.filter(function (s) { return s.ok; }).length;
  return { pct: Math.round(100 * done / steps.length), steps: steps };
}

export function nowIso() {
  return new Date().toISOString();
}

// Read a file shipped with the function (vercel.json includeFiles: private/**).
const fileCache = {};
export function privateFile(name) {
  if (fileCache[name]) return fileCache[name];
  const candidates = [
    path.join(process.cwd(), "private", name),
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", "private", name)
  ];
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, "utf8");
      fileCache[name] = txt;
      return txt;
    } catch (e) { /* try next */ }
  }
  return "";
}

// The exact same 404 page a visitor sees for any wrong link.
export function send404Page(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(privateFile("404.html") || "<!doctype html><title>404</title><h1>404</h1><p>This page could not be found.</p>");
}

export function sendNotFoundJson(res) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ error: "Not found" }));
}

// ---------------- admin access ----------------
// Admins = emails in the Supabase table admin_emails. SUPER_ADMIN_EMAIL (Vercel env) is always admin
// and is the only one allowed to send messages / notifications.
export async function isAdminEmail(email) {
  const e = lower(email);
  if (!e) return { admin: false, isSuper: false };
  const sup = superEmail();
  if (sup && e === sup) return { admin: true, isSuper: true };
  try {
    const rows = await db("admin_emails?select=email&email=eq." + encodeURIComponent(e) + "&limit=1");
    if (Array.isArray(rows) && rows.length) return { admin: true, isSuper: false };
  } catch (err) {
    console.error("isAdminEmail", err.message);
  }
  return { admin: false, isSuper: false };
}

export async function adminLevel(req) {
  const u = getUser(req);
  if (!u || !u.email) return null;
  const a = await isAdminEmail(u.email);
  if (!a.admin) return null;
  return { user: u, email: lower(u.email), isSuper: a.isSuper };
}

// Emails that must never be created through the public signup form.
export async function isReservedEmail(email) {
  const a = await isAdminEmail(email);
  return a.admin;
}

// ---------------- profiles ----------------
export async function upsertProfile(p) {
  const body = {
    id: p.id,
    email: lower(p.email),
    name: p.name || null,
    phone: p.phone || null,
    last_seen_at: nowIso()
  };
  if (p.ref) body.ref = String(p.ref).slice(0, 200);
  if (p.vid) body.first_vid = String(p.vid).slice(0, 64);
  // Do not overwrite a saved name/phone with empty values.
  Object.keys(body).forEach(function (k) { if (body[k] === null) delete body[k]; });
  try {
    await db("profiles?on_conflict=id", {
      method: "POST",
      body: body,
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  } catch (e) {
    console.error("upsertProfile", e.message, JSON.stringify(e.detail || {}));
  }
}

export async function getProfile(id) {
  try {
    const rows = await db("profiles?select=*&id=eq." + encodeURIComponent(id) + "&limit=1");
    return rows && rows[0] ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

// ---------------- storage (message images) ----------------
export const MSG_BUCKET = "gmp-messages";

export async function uploadImage(dataUrl) {
  const m = String(dataUrl || "").match(/^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new Error("Image must be a PNG, JPG, WEBP or GIF.");
  const buf = Buffer.from(m[3], "base64");
  if (buf.length > 3 * 1024 * 1024) throw new Error("Image is too big. Keep it under 3 MB.");
  const ext = m[2] === "jpeg" ? "jpg" : m[2];
  const name = new Date().toISOString().slice(0, 10) + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  const r = await fetch(base + "/storage/v1/object/" + MSG_BUCKET + "/" + name, {
    method: "POST",
    headers: { "apikey": key, "Authorization": "Bearer " + key, "Content-Type": m[1], "x-upsert": "true", "cache-control": "31536000" },
    body: buf
  });
  if (!r.ok) {
    const t = await r.text().catch(function () { return ""; });
    throw new Error("Image upload failed (" + r.status + "). Run the storage part of supabase.sql. " + t.slice(0, 160));
  }
  return base + "/storage/v1/object/public/" + MSG_BUCKET + "/" + name;
}

// ---------------- web push ----------------
export function vapidPublic() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

let webpushMod = null;
async function webpush() {
  if (webpushMod) return webpushMod;
  const mod = await import("web-push");
  const wp = mod.default || mod;
  wp.setVapidDetails(
    "mailto:" + (process.env.SUPER_ADMIN_EMAIL || process.env.EMAIL_FROM || "hello@example.com"),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  webpushMod = wp;
  return wp;
}

// Sends a payload (object, or function(sub) -> object) to many subscriptions. Removes dead subscriptions. Never throws.
export async function pushTo(subs, payload) {
  const out = { ok: 0, failed: 0 };
  if (!subs.length || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    out.failed = subs.length;
    return out;
  }
  let wp;
  try { wp = await webpush(); } catch (e) {
    console.error("web-push not available", e.message);
    out.failed = subs.length;
    return out;
  }
  const dead = [];
  // small batches so we do not open too many connections at once
  for (let i = 0; i < subs.length; i += 20) {
    const part = subs.slice(i, i + 20);
    await Promise.all(part.map(async function (s) {
      try {
        const body = JSON.stringify(typeof payload === "function" ? payload(s) : payload);
        await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3 * 86400, urgency: "high" });
        out.ok++;
      } catch (e) {
        out.failed++;
        if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.id);
        else console.error("push failed", (e && (e.statusCode || e.code || e.message)) || e);
      }
    }));
  }
  if (dead.length) {
    try { await db("push_subscriptions?id=in.(" + dead.join(",") + ")", { method: "DELETE", prefer: "return=minimal" }); } catch (e) { /* ignore */ }
  }
  return out;
}

// ---------------- validation ----------------
export const PLATFORMS = ["etsy", "shopify", "ebay"];
export const TARGETS = [10, 100, 1000];
export const WAITS = [1, 2, 3, 6];

export function cleanUrl(s) {
  let v = String(s || "").trim().slice(0, 500);
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (u.hostname.indexOf(".") < 0) return "";
    return u.toString();
  } catch (e) {
    return "";
  }
}
