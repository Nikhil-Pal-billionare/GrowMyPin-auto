// Site settings you change from Admin > Settings (offer, ribbon, home banner, popup ...).
// Stored in Supabase table site_settings (one row, id = 1). Anything missing uses DEFAULTS.

import { db } from "./app.js";

// ---------------- Growth graph data (Admin > Growth graph) ----------------
// Numbers belong to a RANK (Best, 2nd best, Middle, 2nd worst, Worst), not to a strategy.
// You decide in the admin panel which strategy sits at which rank, for all niches or per niche,
// so the strategy you put at "Best" always gets the Best numbers.
// views  = Pinterest views in that month (monthly total, month 1 to 6), for a new account.
// visits = store visits from Pinterest in that month (Etsy store; Shopify / eBay use the store % below).
export const STRATEGY_IDS = ["trend", "gift", "evergreen", "hook", "lifestyle"];
export const RANKS = 5;
export const MONTHS = 6;

const DEFAULT_STRATEGIES = {
  trend: { name: "Trend wave", short: "Pins on what buyers search this month" },
  gift: { name: "Gift angle", short: "Gift for mom, for her, for him pins with buying intent" },
  evergreen: { name: "Evergreen SEO", short: "Keyword pins that keep ranking for months" },
  hook: { name: "Curiosity hooks", short: "Big text hooks that stop the scroll" },
  lifestyle: { name: "Lifestyle glow", short: "Warm, glowing lifestyle scenes around the product" }
};

// Best rank numbers per niche. Lower ranks are filled with tier_pct until you type your own.
const DEFAULT_BEST = [
  ["Home Decor", [5000, 21000, 54000, 98000, 145000, 195000], [45, 210, 590, 1150, 1750, 2400]],
  ["Jewelry", [3000, 12500, 34000, 62000, 94000, 128000], [30, 150, 440, 850, 1300, 1800]],
  ["Engagement Rings", [2600, 11000, 30000, 56000, 86000, 118000], [28, 140, 410, 790, 1220, 1700]],
  ["Fashion", [5500, 23000, 58000, 104000, 152000, 205000], [40, 190, 520, 990, 1500, 2050]],
  ["Health and Wellness", [2200, 9000, 25000, 47000, 72000, 99000], [22, 105, 310, 610, 950, 1320]],
  ["Digital Products", [3200, 14000, 38000, 70000, 106000, 145000], [40, 200, 580, 1120, 1720, 2380]],
  ["Crafts and Patterns", [4200, 18000, 47000, 86000, 128000, 172000], [48, 230, 650, 1250, 1900, 2600]],
  ["Other", [3000, 13000, 35000, 64000, 96000, 130000], [30, 140, 400, 780, 1200, 1650]]
];
const DEFAULT_TIER_PCT = [100, 80, 63, 47, 33];

function fillRanks(best, pct) {
  return pct.map(function (p) { return best.map(function (v) { return Math.round(v * p / 100); }); });
}

export const DEFAULT_GROWTH = {
  strategies: DEFAULT_STRATEGIES,
  // order = Best, 2nd best, Middle, 2nd worst, Worst. "_all" is used by every niche without its own order.
  rank: {
    _all: ["gift", "trend", "hook", "lifestyle", "evergreen"],
    "Home Decor": ["trend", "lifestyle", "hook", "gift", "evergreen"],
    "Digital Products": ["evergreen", "hook", "trend", "gift", "lifestyle"]
  },
  tier_pct: DEFAULT_TIER_PCT,
  niches: DEFAULT_BEST.map(function (r) {
    return { name: r[0], views: fillRanks(r[1], DEFAULT_TIER_PCT), visits: fillRanks(r[2], DEFAULT_TIER_PCT) };
  }),
  // bonus by pins already on the user's Pinterest: 0, 1-24, 25-99, 100-299, 300+ (100 = no change)
  pins_pct: [100, 105, 112, 122, 135],
  // store visits % (Etsy = your data) and sale conversion % per store
  stores: {
    etsy: { visits: 100, cvr: 2.5 },
    shopify: { visits: 85, cvr: 1.6 },
    ebay: { visits: 75, cvr: 2 }
  },
  // +/- this % so two shops in the same niche never get the exact same graph
  vary: 5
};

function num(v, lo, hi, dec) {
  let n = Number(v);
  if (!isFinite(n)) return null;
  n = Math.min(hi, Math.max(lo, n));
  const f = Math.pow(10, dec || 0);
  return Math.round(n * f) / f;
}
function numRow(arr, len, lo, hi, dec) {
  if (!Array.isArray(arr) || arr.length !== len) return null;
  const out = [];
  for (let i = 0; i < len; i++) {
    const n = num(arr[i], lo, hi, dec);
    if (n === null) return null;
    out.push(n);
  }
  return out;
}
function isRank(a) {
  return Array.isArray(a) && a.length === RANKS && STRATEGY_IDS.every(function (id) { return a.indexOf(id) > -1; });
}
function nicheName(s) {
  return asciiClean(s, 30).replace(/[^A-Za-z0-9 &+'\/-]/g, "").replace(/\s+/g, " ").trim();
}

// Always returns a complete, valid growth object (missing or broken parts use defaults).
export function normalizeGrowth(g) {
  const d = DEFAULT_GROWTH;
  g = g && typeof g === "object" ? g : {};
  const out = { strategies: {}, rank: {}, tier_pct: [], niches: [], pins_pct: [], stores: {}, vary: d.vary };
  const st = g.strategies && typeof g.strategies === "object" ? g.strategies : {};
  STRATEGY_IDS.forEach(function (id) {
    const s = st[id] || {};
    out.strategies[id] = {
      name: asciiClean(s.name, 30).replace(/[^\x20-\x7E]/g, "") || d.strategies[id].name,
      short: asciiClean(s.short, 110).replace(/[^\x20-\x7E]/g, "") || d.strategies[id].short
    };
  });
  out.tier_pct = numRow(g.tier_pct, RANKS, 0, 100, 0) || d.tier_pct.slice();
  out.pins_pct = numRow(g.pins_pct, 5, 10, 500, 0) || d.pins_pct.slice();
  const vary = num(g.vary, 0, 20, 0);
  out.vary = vary === null ? d.vary : vary;
  ["etsy", "shopify", "ebay"].forEach(function (p) {
    const s = (g.stores && g.stores[p]) || {};
    const v = num(s.visits, 0, 300, 0), c = num(s.cvr, 0, 100, 2);
    out.stores[p] = { visits: v === null ? d.stores[p].visits : v, cvr: c === null ? d.stores[p].cvr : c };
  });

  const seen = {};
  const list = Array.isArray(g.niches) && g.niches.length ? g.niches : d.niches;
  list.slice(0, 24).forEach(function (n) {
    if (!n || typeof n !== "object") return;
    const name = nicheName(n.name);
    if (!name || seen[name.toLowerCase()]) return;
    const def = d.niches.find(function (x) { return x.name === name; }) || d.niches[d.niches.length - 1];
    function matrix(m, key) {
      const rows = [];
      const src = Array.isArray(m) ? m : [];
      for (let r = 0; r < RANKS; r++) {
        const row = numRow(src[r], MONTHS, 0, 1e9, 0);
        if (row) rows.push(row);
        else if (rows[0]) rows.push(rows[0].map(function (v) { return Math.round(v * out.tier_pct[r] / 100); }));
        else rows.push(def[key][r].slice());
      }
      return rows;
    }
    seen[name.toLowerCase()] = 1;
    out.niches.push({ name: name, views: matrix(n.views, "views"), visits: matrix(n.visits, "visits") });
  });
  if (!seen.other) {
    const o = d.niches.find(function (x) { return x.name === "Other"; });
    out.niches.push({ name: "Other", views: o.views.map(function (r) { return r.slice(); }), visits: o.visits.map(function (r) { return r.slice(); }) });
  }

  const rk = g.rank && typeof g.rank === "object" ? g.rank : d.rank;
  out.rank._all = isRank(rk._all) ? rk._all.slice() : d.rank._all.slice();
  out.niches.forEach(function (n) {
    if (isRank(rk[n.name])) out.rank[n.name] = rk[n.name].slice();
  });
  return out;
}

// ---------------- Plans + view levels (Admin > Plans) ----------------
// Plans are shown ONLY after the person connects Pinterest (home page reveal), never before.
// price / compare are in rupees. compare = the old price shown with a line through it (0 = none).
// levels: the person pays the level charge for the monthly views level they are in (view-based charge).
export const DEFAULT_PLANS = {
  enabled: true,
  items: [
    { id: "m1", on: true, name: "Monthly", months: 1, price: 1499, compare: 2999, tag: "Diwali price", levels: true },
    { id: "m3", on: true, name: "3 months", months: 3, price: 2999, compare: 0, tag: "Recommended", levels: true },
    { id: "m6", on: true, name: "6 months", months: 6, price: 5999, compare: 0, tag: "", levels: true },
    { id: "m12", on: true, name: "1 year", months: 12, price: 11999, compare: 0, tag: "Best value", levels: true }
  ],
  featured: "m3",
  levels: [
    { views: 25000, charge: 1499 },
    { views: 50000, charge: 2500 },
    { views: 100000, charge: 4000 },
    { views: 200000, charge: 5500 }
  ],
  headline: "Turn this forecast into real store visits",
  note: "You pay a level charge only when your monthly Pinterest views reach that level."
};
const PLAN_IDS = ["m1", "m3", "m6", "m12"];

function planText(s, max) {
  return String(s == null ? "" : s).replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014\u2212]/g, "-").replace(/\u2026/g, "...").replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizePlans(p) {
  const d = DEFAULT_PLANS;
  const src = p && typeof p === "object" ? p : {};
  const out = { enabled: src.enabled === undefined ? d.enabled : src.enabled === true, items: [], levels: [] };
  const given = Array.isArray(src.items) ? src.items : [];
  PLAN_IDS.forEach(function (id) {
    const def = d.items.find(function (x) { return x.id === id; });
    const it = given.find(function (x) { return x && x.id === id; }) || def;
    const price = Math.round(Number(it.price));
    const compare = Math.round(Number(it.compare));
    out.items.push({
      id: id,
      on: it.on === undefined ? true : it.on === true,
      name: planText(it.name, 30) || def.name,
      months: def.months,
      price: price >= 1 && price <= 500000 ? price : def.price,
      compare: compare > 0 && compare <= 1000000 ? compare : 0,
      tag: planText(it.tag, 24),
      levels: it.levels === undefined ? true : it.levels === true
    });
  });
  out.featured = PLAN_IDS.indexOf(src.featured) > -1 ? src.featured : d.featured;
  const lv = Array.isArray(src.levels) ? src.levels : d.levels;
  const seen = {};
  lv.slice(0, 8).forEach(function (l) {
    if (!l) return;
    const v = Math.round(Number(l.views)), c = Math.round(Number(l.charge));
    if (!(v >= 1000 && v <= 100000000) || !(c >= 0 && c <= 500000) || seen[v]) return;
    seen[v] = 1;
    out.levels.push({ views: v, charge: c });
  });
  out.levels.sort(function (a, b) { return a.views - b.views; });
  out.headline = planText(src.headline, 90) || d.headline;
  out.note = planText(src.note, 200) || d.note;
  return out;
}

export function findPlan(plans, id) {
  const p = (plans && plans.items || []).find(function (x) { return x.id === id; });
  return p && p.on ? p : null;
}

// ---------------- Landing page banners (Admin > Banners) ----------------
// Auto-swiping banners at the top of the landing page. Add as many as you want (max 20).
// theme: night (purple sky), green, gold, light, dark. offer_only: show only while the offer is live.
// Text shortcuts: {offer} offer name, {percent} discount.
export const BANNER_THEMES = ["night", "green", "gold", "light", "dark"];
export const DEFAULT_BANNERS = {
  enabled: true,
  interval: 5,
  items: [
    { id: "b1", on: true, theme: "night", offer_only: true, kicker: "{offer}", title: "Up to {percent}% off GrowMyPin plans", text: "Reserve your slot today. The offer price is locked for you once you sign up.", btn: "Reserve my slot", link: "/signup.html", image: "" },
    { id: "b2", on: true, theme: "green", offer_only: false, kicker: "Pinterest + blogs", title: "More buyers for your Etsy and Shopify store", text: "We send real traffic from Pinterest and blog posts straight to your product listings.", btn: "Sign up", link: "/signup.html", image: "" },
    { id: "b3", on: true, theme: "light", offer_only: false, kicker: "Free in 2 minutes", title: "See your 6 month growth forecast", text: "Tell us what you sell and get a personal Pinterest views and store visits forecast.", btn: "Get my forecast", link: "/signup.html", image: "" },
    { id: "b4", on: true, theme: "gold", offer_only: false, kicker: "You stay in control", title: "Nothing goes live until you approve", text: "Every pin and blog post waits for your OK before it is published.", btn: "See how it works", link: "#process", image: "" }
  ]
};

function bannerLink(v) {
  const s = planText(v, 300);
  if (!s) return "";
  if (/^#[A-Za-z0-9_-]{1,60}$/.test(s)) return s;
  if (/^\/[A-Za-z0-9_.\-\/?=&#%]*$/.test(s) && s.indexOf("//") !== 0) return s;
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s;
  if (/^https:\/\/wa\.me\//i.test(s)) return s;
  return "";
}
function bannerImage(v) {
  const s = String(v || "").trim().slice(0, 500);
  return /^https:\/\/[^\s"'<>()]+$/i.test(s) ? s : "";
}

export function normalizeBanners(b) {
  const d = DEFAULT_BANNERS;
  const src = b && typeof b === "object" ? b : {};
  const iv = Number(src.interval);
  const out = {
    enabled: src.enabled === undefined ? d.enabled : src.enabled === true,
    interval: iv >= 2 && iv <= 30 ? Math.round(iv * 2) / 2 : d.interval,
    items: []
  };
  const list = Array.isArray(src.items) ? src.items : d.items;
  const seen = {};
  list.slice(0, 20).forEach(function (it, i) {
    if (!it || typeof it !== "object") return;
    let id = String(it.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20) || ("b" + Date.now().toString(36) + i);
    if (seen[id]) id = id + "_" + i;
    seen[id] = 1;
    const title = planText(it.title, 90);
    if (!title) return;
    out.items.push({
      id: id,
      on: it.on === undefined ? true : it.on === true,
      theme: BANNER_THEMES.indexOf(it.theme) > -1 ? it.theme : "green",
      offer_only: it.offer_only === true,
      kicker: planText(it.kicker, 40),
      title: title,
      text: planText(it.text, 160),
      btn: planText(it.btn, 28),
      link: bannerLink(it.link),
      image: bannerImage(it.image)
    });
  });
  return out;
}

// ---------------- Landing page pins (right side animation, Admin > Banners) ----------------
// Real pin images in the moving board + the "Draft -> Approved" card. title = the pin title typed in the card,
// name = short caption under the pin, tag = small label. image = /showcase/... (in the repo) or an https link.
export const DEFAULT_SHOWCASE = {
  items: [
    { image: "/showcase/ring.jpg", title: "Oval moissanite engagement ring gift idea for her", name: "Engagement rings", tag: "Jewelry" },
    { image: "/showcase/runner.jpg", title: "Luxury hand-tufted stair runner for a grand entrance", name: "Stair runner", tag: "Home decor" },
    { image: "/showcase/bracelet.jpg", title: "Minimalist silver bracelet, an everyday gift for her", name: "Silver bracelet", tag: "Jewelry" },
    { image: "/showcase/poster.jpg", title: "Virat Kohli framed wall poster for cricket fans", name: "Wall art", tag: "Gifts" },
    { image: "/showcase/haircare.jpg", title: "Natural hair care routine for stronger, shinier hair", name: "Hair care", tag: "Wellness" },
    { image: "/showcase/crochet.jpg", title: "Adorable crochet deer amigurumi pattern PDF", name: "Crochet patterns", tag: "DIY" }
  ]
};
export function normalizeShowcase(v) {
  const src = v && typeof v === "object" && Array.isArray(v.items) ? v.items : DEFAULT_SHOWCASE.items;
  const items = [];
  src.slice(0, 16).forEach(function (it) {
    if (!it) return;
    const raw = String(it.image || "").trim().slice(0, 500);
    const image = /^\/showcase\/[A-Za-z0-9_.-]+$/.test(raw) || /^https:\/\/[^\s"'<>()]+$/i.test(raw) ? raw : "";
    if (!image) return;
    items.push({ image: image, title: planText(it.title, 80) || "Pin draft", name: planText(it.name, 30) || "Pin", tag: planText(it.tag, 16) });
  });
  return { items: items.length ? items : DEFAULT_SHOWCASE.items.slice() };
}

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
  pins_from_profile_link: true,

  // Growth graph numbers, strategy ranking, pins bonus (Admin > Growth graph)
  growth: DEFAULT_GROWTH,

  // Plans and view levels (Admin > Plans). Never sent to browsers before Pinterest is connected.
  plans: DEFAULT_PLANS,

  // Landing page banners (Admin > Banners)
  banners: DEFAULT_BANNERS,

  // Landing page pins in the right side animation (Admin > Banners)
  showcase: DEFAULT_SHOWCASE
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
  cache.growth = normalizeGrowth(data.growth);
  cache.plans = normalizePlans(data.plans);
  cache.banners = normalizeBanners(data.banners);
  cache.showcase = normalizeShowcase(data.showcase);
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
  if (b.growth !== undefined) out.growth = normalizeGrowth(b.growth);
  if (b.banners !== undefined) out.banners = normalizeBanners(b.banners);
  if (b.showcase !== undefined) out.showcase = normalizeShowcase(b.showcase);
  if (b.plans !== undefined) {
    out.plans = normalizePlans(b.plans);
    if (!out.plans.items.some(function (x) { return x.on; })) return { ok: false, error: "Keep at least one plan on." };
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
  // prices are not public: they go only to people who connected Pinterest (see /api/user/home)
  delete out.plans;
  let host = "";
  try { host = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : ""; } catch (e) { host = ""; }
  out.site_host = host;
  out.offer_active = active;
  out.server_time = new Date(now).toISOString();
  return out;
}
