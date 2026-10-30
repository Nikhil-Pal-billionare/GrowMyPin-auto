// Admin panel. Every admin route answers with the normal 404 page / 404 JSON
// unless the logged-in GrowMyPin account is an admin:
//   - SUPER_ADMIN_EMAIL (Vercel env)  -> full access + can send messages
//   - emails in Supabase table admin_emails -> can see the dashboard only
//
// GET  /admin                     -> dashboard page (private/admin.html)
// GET  /api/admin/data?days=30    -> stats, signups, reservations, messages
// POST /api/admin/message         -> send a text / image message + phone notification (super only)
// GET  /api/admin/settings        -> offer, ribbon, banner, popup settings (any admin can view)
// POST /api/admin/settings        -> save settings (super only)
// GET  /api/admin/admins          -> admin list (super only)
// POST /api/admin/admins          -> { action: "add", email, password?, note } or { action: "remove", email } (super only)
// GET  /api/admin/payments        -> Razorpay payments + active plans (any admin can view)

import { sendJson } from "../lib.js";
import { db, sbAuth, cleanEmail, authError } from "../app.js";
import { getSettings, cleanSettings, saveSettings, publicSettings, DEFAULTS } from "../settings.js";
import { razorpayReady, isTestMode } from "../billing.js";
import {
  adminLevel, privateFile, send404Page, sendNotFoundJson,
  uploadImage, pushTo, cleanUrl, superEmail
} from "../growth.js";

async function page(req, res) {
  const a = await adminLevel(req);
  if (!a) return send404Page(res);
  const html = privateFile("admin.html");
  if (!html) return send404Page(res);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Frame-Options", "DENY");
  res.end(html);
}

async function data(req, res) {
  const a = await adminLevel(req);
  if (!a) return sendNotFoundJson(res);
  const url = new URL(req.url, "http://localhost");
  let days = parseInt(url.searchParams.get("days") || "30", 10);
  if ([1, 7, 30, 90, 365].indexOf(days) < 0) days = 30;

  // v1.3 columns (niche, pins) are asked for first; if supabase.sql v1.3 was not run yet, load without them.
  function people(extra) {
    return db("profiles?select=id,email,name,phone,offer_status,offer_at,created_at,last_seen_at,ref," +
      "platforms,shop_links,pinterest_url,target_sales,wait_months,interest_at,interest_count,interest_source," + extra +
      "slot_reservations(id,platforms,target_sales,wait_months,links,has_pinterest,pinterest_url,phone,created_at)," +
      "push_subscriptions(count)&order=created_at.desc&limit=2000");
  }
  let mode = url.searchParams.get("mode") || "real";
  if (["real", "bot", "staff", "all"].indexOf(mode) < 0) mode = "real";
  const jobs = [
    // v1.5 splits real people / bots / staff; older database without it: old function (everyone)
    db("rpc/gmp_admin_stats", { method: "POST", body: { days: days, view_mode: mode } })
      .catch(function () { return db("rpc/gmp_admin_stats", { method: "POST", body: { days: days } }); }),
    people("niche,pins_count,pin_stats,").catch(function () { return people(""); })
  ];
  if (a.isSuper) {
    jobs.push(db("user_messages?select=id,user_id,title,body,image_url,created_at,seen_at,push_ok,profiles(name,email)&order=created_at.desc&limit=150"));
  }
  jobs.push(db("admin_emails?select=email").catch(function () { return []; }));
  const out = await Promise.all(jobs);
  // hide admin accounts from the people list
  const adminSet = {};
  (out[out.length - 1] || []).forEach(function (r) { adminSet[String(r.email).toLowerCase()] = 1; });
  if (superEmail()) adminSet[superEmail()] = 1;
  const users = (out[1] || []).filter(function (u) { return !adminSet[String(u.email || "").toLowerCase()]; });
  sendJson(res, 200, {
    me: { email: a.email, is_super: a.isSuper },
    days: days,
    stats: out[0],
    users: users,
    messages: a.isSuper ? (out[2] || []) : null
  });
}

async function message(req, res) {
  const a = await adminLevel(req);
  if (!a) return sendNotFoundJson(res);
  // Normal admins do not even learn this feature exists.
  if (!a.isSuper) return sendNotFoundJson(res);
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });

  const b = req.body || {};
  const text = String(b.text || "").trim().slice(0, 1500);
  const title = String(b.title || "").trim().slice(0, 80) || "Message from GrowMyPin";
  let imageUrl = "";
  try {
    if (b.image) imageUrl = await uploadImage(b.image);
    else if (b.image_url) imageUrl = cleanUrl(b.image_url);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  if (!text && !imageUrl) return sendJson(res, 400, { error: "Write a message or add an image." });

  // who gets it
  let ids = [];
  if (b.to === "all") {
    const rows = await db("profiles?select=id&limit=5000");
    ids = rows.map(function (r) { return r.id; });
  } else if (Array.isArray(b.to)) {
    ids = b.to.map(function (x) { return String(x).replace(/[^0-9a-f-]/gi, ""); }).filter(function (x) { return x.length >= 32; }).slice(0, 5000);
  } else {
    const one = String(b.to || "").replace(/[^0-9a-f-]/gi, "");
    if (one.length >= 32) ids = [one];
  }
  if (!ids.length) return sendJson(res, 400, { error: "Pick who gets this message." });

  // save one message row per person, so each person has their own "seen"
  const rows = [];
  for (let i = 0; i < ids.length; i += 500) {
    const part = ids.slice(i, i + 500).map(function (id) {
      return { user_id: id, title: title, body: text || null, image_url: imageUrl || null, sent_by: a.email };
    });
    const saved = await db("user_messages?select=id,user_id", { method: "POST", body: part });
    (saved || []).forEach(function (r) { rows.push(r); });
  }
  const msgByUser = {};
  rows.forEach(function (r) { msgByUser[r.user_id] = r.id; });

  // phone / browser notifications
  let subs = [];
  for (let i = 0; i < ids.length; i += 150) {
    const part = ids.slice(i, i + 150);
    const s = await db("push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(" + part.join(",") + ")");
    subs = subs.concat(s || []);
  }
  const preview = text ? (text.length > 140 ? text.slice(0, 137) + "..." : text) : "Sent you a new image. Tap to open.";
  const result = await pushTo(subs, function (s) {
    const id = msgByUser[s.user_id];
    return { title: title, body: preview, image: imageUrl || undefined, url: "/?msg=" + id, tag: "gmp-msg-" + id };
  });

  // remember how many devices got the push for each message (best effort)
  if (result.ok && rows.length === 1) {
    db("user_messages?id=eq." + rows[0].id, { method: "PATCH", body: { push_ok: result.ok }, prefer: "return=minimal" }).catch(function () {});
  } else if (result.ok) {
    const withPush = {};
    subs.forEach(function (s) { withPush[s.user_id] = (withPush[s.user_id] || 0) + 1; });
    const msgIds = Object.keys(withPush).map(function (uid) { return msgByUser[uid]; }).filter(Boolean);
    if (msgIds.length) {
      db("user_messages?id=in.(" + msgIds.slice(0, 1000).join(",") + ")", { method: "PATCH", body: { push_ok: 1 }, prefer: "return=minimal" }).catch(function () {});
    }
  }

  sendJson(res, 200, {
    ok: true,
    people: rows.length,
    devices: subs.length,
    pushed: result.ok,
    push_failed: result.failed,
    image_url: imageUrl || null
  });
}

async function settings(req, res) {
  const a = await adminLevel(req);
  if (!a) return sendNotFoundJson(res);
  if (req.method === "POST") {
    if (!a.isSuper) return sendNotFoundJson(res);
    const c = cleanSettings(req.body || {});
    if (!c.ok) return sendJson(res, 400, { error: c.error });
    const saved = await saveSettings(c.data, a.email);
    return sendJson(res, 200, { ok: true, settings: saved, live: publicSettings(saved) });
  }
  const s = await getSettings(true);
  let meta = null;
  try {
    const rows = await db("site_settings?select=updated_at,updated_by&id=eq.1");
    meta = rows && rows[0] ? rows[0] : null;
  } catch (e) { /* ignore */ }
  sendJson(res, 200, { settings: s, defaults: DEFAULTS, live: publicSettings(s), meta: meta, can_edit: a.isSuper });
}

async function admins(req, res) {
  const a = await adminLevel(req);
  if (!a || !a.isSuper) return sendNotFoundJson(res);
  if (req.method === "POST") {
    const b = req.body || {};
    const email = cleanEmail(b.email);
    if (!email) return sendJson(res, 400, { error: "Add a valid email address." });
    if (email === superEmail()) return sendJson(res, 400, { error: "This is the owner email from Vercel. It is always admin." });
    if (b.action === "remove") {
      await db("admin_emails?email=eq." + encodeURIComponent(email), { method: "DELETE", prefer: "return=minimal" });
      return sendJson(res, 200, { ok: true, removed: email });
    }
    if (b.action === "add") {
      const note = String(b.note || "").trim().slice(0, 80);
      const password = String(b.password || "");
      let login = "existing";
      if (password) {
        if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
        const created = await sbAuth("/admin/users", { email: email, password: password, email_confirm: true, user_metadata: { name: note || "Admin" } }, { admin: true });
        if (created.ok) login = "created";
        else if (created.status === 422 || /already|exists|registered/i.test(JSON.stringify(created.data || {}))) login = "existing";
        else return sendJson(res, 400, { error: "Could not create the login: " + authError(created.data) });
      }
      await db("admin_emails?on_conflict=email", { method: "POST", body: { email: email, note: note || null }, prefer: "resolution=merge-duplicates,return=minimal" });
      return sendJson(res, 200, { ok: true, added: email, login: password ? login : "none" });
    }
    return sendJson(res, 400, { error: "Unknown action" });
  }
  const rows = await db("admin_emails?select=email,note,created_at&order=created_at.asc");
  sendJson(res, 200, { owner: superEmail(), admins: rows || [] });
}

// POST /api/admin/upload { image: "data:image/png;base64,..." } -> { url }  (owner only, banner images)
async function upload(req, res) {
  const a = await adminLevel(req);
  if (!a || !a.isSuper) return sendNotFoundJson(res);
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const url = await uploadImage((req.body || {}).image);
    return sendJson(res, 200, { url: url });
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
}

async function payments(req, res) {
  const a = await adminLevel(req);
  if (!a) return sendNotFoundJson(res);
  let rows = [], active = [], missing = false;
  try {
    const out = await Promise.all([
      db("payments?select=id,user_id,email,name,phone,plan_id,plan_name,months,amount,currency,status,method,razorpay_order_id,razorpay_payment_id,test_mode,created_at,paid_at,period_end&order=created_at.desc&limit=500"),
      db("profiles?select=id,email,name,phone,plan_id,plan_name,plan_until&plan_until=gt." + new Date().toISOString() + "&order=plan_until.asc&limit=1000")
    ]);
    rows = out[0] || [];
    active = out[1] || [];
  } catch (e) {
    missing = true;
  }
  sendJson(res, 200, { ready: razorpayReady(), test_mode: isTestMode(), missing_sql: missing, payments: rows, active: active });
}

export default async function handler(req, res, sub) {
  try {
    if (sub === "page") return await page(req, res);
    if (sub === "data") return await data(req, res);
    if (sub === "message") return await message(req, res);
    if (sub === "settings") return await settings(req, res);
    if (sub === "admins") return await admins(req, res);
    if (sub === "payments") return await payments(req, res);
    if (sub === "upload") return await upload(req, res);
    return sendNotFoundJson(res);
  } catch (e) {
    console.error("admin", e.message, JSON.stringify(e.detail || {}).slice(0, 400));
    // still do not reveal anything to non-admins
    const a = await adminLevel(req).catch(function () { return null; });
    if (!a) return sub === "page" ? send404Page(res) : sendNotFoundJson(res);
    sendJson(res, 500, { error: e.message + (e.detail && e.detail.message ? ": " + e.detail.message : "") });
  }
}
