// Site settings you change from Admin > Settings (offer, ribbon, home banner, popup ...).
// Stored in Supabase table site_settings (one row, id = 1). Anything missing uses DEFAULTS.

import { db } from "./app.js";

export const DEFAULTS = {
  // Offer shown right after sign up
  offer_enabled: true,
  offer_name: "Diwali offer",
  offer_percent: 50,
  offer_title: "{first}, your shop deserves a bright Diwali",
  offer_before: "Get up to a huge",
  offer_after: "discount on GrowMyPin plans",
  offer_start: "2026-10-20T00:00:00+05:30",
  offer_end: "2026-11-11T23:59:59+05:30",
  offer_reserve_btn: "Reserve my slot",
  offer_regret_btn: "I'll regret",
  offer_diyas: true,

  // Small ribbon at the bottom of pages
  ribbon_enabled: true,
  ribbon_text: "{offer}: up to {percent}% off",
  ribbon_btn: "Reserve my slot",

  // Banner on the personal home page
  home_banner_enabled: true,
  home_banner_text: "Your {offer} price is waiting. Reserve your slot before it ends.",

  // "Your Pinterest views can reach ..." popup
  popup_enabled: true,
  popup_minutes: 2,
  popup_title: "Increase your {store} store visits",
  popup_yes_btn: "I want to increase visits",
  popup_no_btn: "I'll do later",

  // Leads
  sales_whatsapp: "",            // your WhatsApp number for "chat now" buttons, e.g. +919876543210

  // Show pins from a public Pinterest profile link (Pinterest RSS feed) when not connected
  pins_from_profile_link: true
};

const TEXT_LIMITS = {
  offer_name: 40, offer_title: 120, offer_before: 60, offer_after: 80,
  offer_reserve_btn: 30, offer_regret_btn: 30,
  ribbon_text: 80, ribbon_btn: 30,
  home_banner_text: 160,
  popup_title: 80, popup_yes_btn: 40, popup_no_btn: 40
};
const BOOLS = ["offer_enabled", "offer_diyas", "ribbon_enabled", "home_banner_enabled", "popup_enabled", "pins_from_profile_link"];

let cache = null, cacheAt = 0;

export async function getSettings(fresh) {
  if (!fresh && cache && Date.now() - cacheAt < 30000) return cache;
  let data = {};
  try {
    const rows = await db("site_settings?select=data,updated_at&id=eq.1&limit=1");
    if (rows && rows[0] && rows[0].data) data = rows[0].data;
  } catch (e) {
    console.error("settings", e.message);
  }
  cache = Object.assign({}, DEFAULTS, data);
  cacheAt = Date.now();
  return cache;
}

function asciiClean(s, max) {
  return String(s == null ? "" : s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/[\r\n\t]+/g, " ")
    .trim().slice(0, max);
}

// Validates what the admin panel sends. Returns { ok, data } or { ok: false, error }.
export function cleanSettings(input) {
  const b = input || {};
  const out = {};
  Object.keys(TEXT_LIMITS).forEach(function (k) {
    if (b[k] !== undefined) out[k] = asciiClean(b[k], TEXT_LIMITS[k]);
  });
  BOOLS.forEach(function (k) { if (b[k] !== undefined) out[k] = b[k] === true; });
  if (b.offer_percent !== undefined) {
    const p = Math.round(Number(b.offer_percent));
    if (!(p >= 1 && p <= 99)) return { ok: false, error: "Discount must be between 1 and 99." };
    out.offer_percent = p;
  }
  if (b.popup_minutes !== undefined) {
    const m = Number(b.popup_minutes);
    if (!(m >= 0.5 && m <= 120)) return { ok: false, error: "Popup time must be between 0.5 and 120 minutes." };
    out.popup_minutes = Math.round(m * 2) / 2;
  }
  ["offer_start", "offer_end"].forEach(function (k) {
    if (b[k] !== undefined) {
      const t = new Date(b[k]);
      if (isNaN(t.getTime())) out.__err = "Offer start and end must be valid dates.";
      else out[k] = String(b[k]).slice(0, 40);
    }
  });
  if (out.__err) return { ok: false, error: out.__err };
  if (out.offer_start && out.offer_end && new Date(out.offer_end) <= new Date(out.offer_start)) {
    return { ok: false, error: "Offer end must be after the start." };
  }
  if (b.sales_whatsapp !== undefined) {
    const d = String(b.sales_whatsapp || "").replace(/\D/g, "");
    if (d && (d.length < 10 || d.length > 15)) return { ok: false, error: "WhatsApp number needs 10 to 15 digits with country code." };
    out.sales_whatsapp = d ? "+" + d : "";
  }
  const required = ["offer_name", "offer_reserve_btn", "offer_regret_btn", "ribbon_btn", "popup_yes_btn", "popup_no_btn"];
  for (const k of required) {
    if (out[k] !== undefined && !out[k]) return { ok: false, error: "Please fill " + k.replace(/_/g, " ") + "." };
  }
  return { ok: true, data: out };
}

export async function saveSettings(patch, by) {
  const current = await getSettings(true);
  const stored = {};
  Object.keys(DEFAULTS).forEach(function (k) { stored[k] = current[k]; });
  Object.assign(stored, patch);
  await db("site_settings?id=eq.1", { method: "PATCH", body: { data: stored, updated_at: new Date().toISOString(), updated_by: by }, prefer: "return=minimal" });
  cache = null;
  return getSettings(true);
}

// What every browser may see. offer_active is worked out on the server clock.
export function publicSettings(s) {
  const now = Date.now();
  const start = new Date(s.offer_start).getTime();
  const end = new Date(s.offer_end).getTime();
  const active = !!s.offer_enabled && (!(start > 0) || now >= start) && (!(end > 0) || now <= end);
  const out = {};
  Object.keys(DEFAULTS).forEach(function (k) { out[k] = s[k]; });
  out.offer_active = active;
  out.server_time = new Date(now).toISOString();
  return out;
}
