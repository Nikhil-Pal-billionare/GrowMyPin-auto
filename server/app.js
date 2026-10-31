// Shared helpers for accounts (Supabase Auth), the growth_reports table, emails and
// AI growth report generation. Files starting with "_" are not deployed as routes.

import { seal, unseal, parseCookies, cookieStr, addCookie, isHttpUrl, clip } from "./lib.js";

const USER_COOKIE = "gmp_user";
export const REPORT_DELAY_HOURS = Number(process.env.REPORT_DELAY_HOURS || 4);
const REPORT_MODEL = process.env.REPORT_MODEL || "claude-sonnet-5-5";

// ---------------- env ----------------
function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(name + " env var missing");
  return v;
}

export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const host = (req && req.headers && (req.headers["x-forwarded-host"] || req.headers.host)) || "localhost";
  return "https://" + host;
}

// ---------------- user session (our own sealed cookie) ----------------
export function getUser(req) {
  const raw = parseCookies(req)[USER_COOKIE];
  if (!raw) return null;
  const u = unseal(raw);
  if (!u || !u.id || !u.exp || Date.now() > u.exp) return null;
  return u;
}

// Stay logged in for a year on this device. Every visit (gmp.js -> /api/user/me) renews it,
// so people who use the Studio are never asked to log in again.
const LOGIN_DAYS = 365;

export function setUser(res, user) {
  const days = LOGIN_DAYS;
  const u = { id: user.id, email: user.email, name: user.name || "", whatsapp: user.whatsapp || "", iat: Date.now(), exp: Date.now() + days * 86400000 };
  addCookie(res, cookieStr(USER_COOKIE, seal(u), days * 86400));
  // Readable hint (no data inside) so the landing page can jump straight to /home.html.
  addCookie(res, "gmp_in=1; Path=/; Secure; SameSite=Lax; Max-Age=" + days * 86400);
  return u;
}

// Renews the login cookie (at most once a day) so an active person never gets logged out.
export function refreshUser(req, res) {
  const u = getUser(req);
  if (!u) return null;
  if (!u.iat || Date.now() - u.iat > 86400000) return setUser(res, u);
  return u;
}

export function clearUser(res) {
  addCookie(res, cookieStr(USER_COOKIE, "", 0));
  addCookie(res, "gmp_in=; Path=/; Secure; SameSite=Lax; Max-Age=0");
}

// ---------------- Supabase ----------------
export async function sbAuth(path, body, opts) {
  const o = opts || {};
  const key = o.admin ? env("SUPABASE_SERVICE_KEY") : env("SUPABASE_ANON_KEY");
  const headers = { "apikey": key, "Content-Type": "application/json" };
  headers.Authorization = "Bearer " + (o.token || key);
  const r = await fetch(env("SUPABASE_URL").replace(/\/+$/, "") + "/auth/v1" + path, {
    method: o.method || "POST",
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(function () { return {}; });
  return { ok: r.ok, status: r.status, data: data };
}

// PostgREST with the service key. Only used on the server.
export async function db(path, opts) {
  const o = opts || {};
  const key = env("SUPABASE_SERVICE_KEY");
  const r = await fetch(env("SUPABASE_URL").replace(/\/+$/, "") + "/rest/v1/" + path, {
    method: o.method || "GET",
    headers: {
      "apikey": key,
      "Authorization": "Bearer " + key,
      "Content-Type": "application/json",
      "Prefer": o.prefer || "return=representation"
    },
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) {
    const err = new Error("Database error " + r.status);
    err.detail = data;
    throw err;
  }
  return data;
}

export function authError(data) {
  const msg = String((data && (data.msg || data.message || data.error_description || data.error)) || "");
  const code = String((data && (data.error_code || data.code)) || "");
  if (/already|exists|registered/i.test(msg + code)) return "An account with this email already exists. Log in instead.";
  if (/invalid.*(credential|grant|login)/i.test(msg + code)) return "Email or password is not correct.";
  if (/password/i.test(msg)) return "Password must be at least 8 characters.";
  if (/rate|too many/i.test(msg + code)) return "Too many attempts. Please wait a few minutes and try again.";
  return msg || "Something went wrong. Please try again.";
}

export function cleanEmail(s) {
  const e = String(s || "").trim().toLowerCase().slice(0, 200);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

export function cleanPhone(s) {
  const p = String(s || "").replace(/[^\d+]/g, "");
  const digits = p.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? p.slice(0, 16) : "";
}

// ---------------- email ----------------
// EMAIL_PROVIDER = "resend" (needs your own verified domain) or "brevo" (can use one verified sender address).
export async function sendEmail(to, subject, html, text) {
  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();
  const from = env("EMAIL_FROM");
  const fromName = process.env.EMAIL_FROM_NAME || "GrowMyPin";
  let r;
  if (provider === "brevo") {
    r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env("BREVO_API_KEY"), "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ sender: { email: from, name: fromName }, to: [{ email: to }], subject: subject, htmlContent: html, textContent: text })
    });
  } else {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + env("RESEND_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromName + " <" + from + ">", to: [to], subject: subject, html: html, text: text })
    });
  }
  if (!r.ok) {
    const body = await r.text().catch(function () { return ""; });
    throw new Error("Email failed " + r.status + " " + body.slice(0, 300));
  }
  return true;
}

export function readyEmail(report, link) {
  const res = report.result || {};
  const m3 = res.months && res.months[2] ? res.months[2].avg : 0;
  const name = report.name ? report.name.split(" ")[0] : "there";
  const fmt = function (n) { return Math.round(Number(n) || 0).toLocaleString("en-IN"); };
  const subject = "Your Pinterest growth report is ready";
  const text = "Hi " + name + ",\n\nYour GrowMyPin growth report for " + report.shop_url + " is ready." +
    (m3 ? "\nAverage case estimate by month 3: " + fmt(m3) + " monthly views." : "") +
    "\n\nSee your 3 and 6 month forecast: " + link +
    "\n\nThis is an average estimate, not real data. Real views depend on your product, images, niche and Pinterest.\n\nGrowMyPin";
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1F242B">' +
    '<h2 style="color:#09423D;margin:0 0 12px">Your growth report is ready</h2>' +
    '<p>Hi ' + esc(name) + ',</p>' +
    '<p>We finished the Pinterest growth report for <b>' + esc(report.shop_url) + '</b>.</p>' +
    (m3 ? '<p style="font-size:15px;background:#E6F6F0;padding:12px 14px;border-radius:10px">Average case by month 3: <b>' + fmt(m3) + ' monthly views</b></p>' : '') +
    '<p><a href="' + esc(link) + '" style="display:inline-block;background:#0F8A76;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">See my 3 and 6 month forecast</a></p>' +
    '<p style="font-size:12px;color:#59606E">This is an average estimate, not real data. Real views depend on your product or service, your images, your niche and Pinterest itself.</p>' +
    '<p style="font-size:12px;color:#59606E">GrowMyPin, Delhi, India</p></div>';
  return { subject: subject, html: html, text: text };
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------- shop reading ----------------
function safePublicUrl(u) {
  if (!isHttpUrl(u)) return null;
  const url = new URL(u);
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return null;
  if (/^[\d.]+$/.test(h) || h.indexOf(":") > -1) return null; // no raw IPs
  return url;
}

async function getText(url, accept) {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowMyPinReport/1.0)", "Accept": accept || "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) return { ok: false, status: r.status, text: "" };
  const buf = await r.arrayBuffer();
  return { ok: true, status: r.status, text: Buffer.from(buf).subarray(0, 1500000).toString("utf8") };
}

function metaOf(html) {
  function m(re) { const x = html.match(re); return x ? x[1].replace(/\s+/g, " ").trim().slice(0, 400) : ""; }
  return {
    title: m(/<title[^>]*>([^<]*)<\/title>/i),
    description: m(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || m(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i),
    siteName: m(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i)
  };
}

function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
}

// Returns a short plain-text summary of the shop for the AI, and which source worked.
export async function readShop(shopUrl) {
  const url = safePublicUrl(shopUrl);
  if (!url) return { source: "none", summary: "Shop link could not be read." };
  const host = url.hostname.toLowerCase();

  // Etsy: official API if a key is configured (Etsy pages usually block servers).
  if (host.endsWith("etsy.com")) {
    const m = url.pathname.match(/\/shop\/([A-Za-z0-9_-]+)/);
    const shopName = m ? m[1] : "";
    if (shopName && process.env.ETSY_API_KEY) {
      try {
        const H = { "x-api-key": process.env.ETSY_API_KEY };
        const s = await fetch("https://openapi.etsy.com/v3/application/shops?shop_name=" + encodeURIComponent(shopName), { headers: H, signal: AbortSignal.timeout(8000) });
        const sj = await s.json();
        const shop = sj && sj.results && sj.results[0];
        if (shop) {
          const l = await fetch("https://openapi.etsy.com/v3/application/shops/" + shop.shop_id + "/listings/active?limit=40", { headers: H, signal: AbortSignal.timeout(8000) });
          const lj = await l.json();
          const items = (lj.results || []).map(function (x) {
            const price = x.price ? (x.price.amount / x.price.divisor) + " " + x.price.currency_code : "";
            return "- " + x.title + (price ? " (" + price + ")" : "") + (x.tags && x.tags.length ? " tags: " + x.tags.slice(0, 6).join(", ") : "");
          });
          return {
            source: "etsy_api",
            summary: "Etsy shop " + shop.shop_name + ". Title: " + (shop.title || "") + ". Active listings: " + (shop.listing_active_count || items.length) +
              ". Sales: " + (shop.transaction_sold_count || "unknown") + ". Reviews average: " + (shop.review_average || "unknown") + "\nListings:\n" + items.join("\n")
          };
        }
      } catch (e) { /* fall through */ }
    }
    try {
      const p = await getText(url.toString());
      if (p.ok) {
        const meta = metaOf(p.text);
        return { source: "etsy_page", summary: "Etsy shop " + shopName + ". " + meta.title + ". " + meta.description + "\n" + visibleText(p.text) };
      }
    } catch (e) { /* ignore */ }
    return { source: "etsy_name", summary: "Etsy shop named " + (shopName || "unknown") + ". The shop page could not be read, so rely on the seller's description." };
  }

  // Shopify (or any store): try the public products feed first.
  try {
    const pj = await getText(url.origin + "/products.json?limit=60", "application/json");
    if (pj.ok) {
      const data = JSON.parse(pj.text);
      if (data && Array.isArray(data.products) && data.products.length) {
        const items = data.products.slice(0, 50).map(function (x) {
          const v = x.variants && x.variants[0];
          return "- " + x.title + (x.product_type ? " [" + x.product_type + "]" : "") + (v && v.price ? " (" + v.price + ")" : "") +
            (x.tags ? " tags: " + (Array.isArray(x.tags) ? x.tags : String(x.tags).split(",")).slice(0, 6).join(", ") : "");
        });
        return { source: "shopify_products", summary: "Shopify store " + url.hostname + ". Products found: " + data.products.length + "\n" + items.join("\n") };
      }
    }
  } catch (e) { /* ignore */ }
  try {
    const p = await getText(url.toString());
    if (p.ok) {
      const meta = metaOf(p.text);
      return { source: "web_page", summary: "Store website " + url.hostname + ". " + meta.siteName + " " + meta.title + ". " + meta.description + "\n" + visibleText(p.text) };
    }
  } catch (e) { /* ignore */ }
  return { source: "none", summary: "Store " + url.hostname + " could not be read, so rely on the seller's description." };
}

// ---------------- AI report ----------------
const BENCHMARKS = [
  "Rough benchmarks for a NEW Pinterest business account posting about 2 optimized pins a day (monthly impressions):",
  "- month 1: often 500 to 5,000 (Pinterest takes 2 to 3 weeks to learn new accounts)",
  "- month 3: home decor 20K to 90K, fashion 20K to 100K, jewelry 10K to 50K, crafts and patterns 15K to 70K, wellness 8K to 40K, digital products 10K to 50K",
  "- month 6: usually 1.5x to 3x of month 3 if posting stays consistent",
  "Seasonality: October and November are peak gift months, December 21 to January 15 Christmas drops and fresh-start content rises.",
  "Accounts that already have traffic grow from their current level, not from zero."
].join("\n");

function asciiOnly(s) {
  const map = {};
  map[String.fromCharCode(8216)] = "'"; map[String.fromCharCode(8217)] = "'";
  map[String.fromCharCode(8220)] = "\""; map[String.fromCharCode(8221)] = "\"";
  map[String.fromCharCode(8211)] = "-"; map[String.fromCharCode(8212)] = "-";
  map[String.fromCharCode(8722)] = "-"; map[String.fromCharCode(8230)] = "...";
  let out = "";
  for (const ch of String(s || "")) {
    if (map[ch] !== undefined) out += map[ch];
    else { const c = ch.charCodeAt(0); if (c >= 32 && c <= 126) out += ch; }
  }
  return out.trim();
}

function buildPrompt(report, shop, analytics, today) {
  return [
    "You are a Pinterest growth analyst at GrowMyPin, a Pinterest marketing company for Etsy and Shopify sellers.",
    "Estimate how many monthly Pinterest views (impressions) this seller's account can get over the next 6 months",
    "if they post optimized pins consistently with GrowMyPin. Be realistic and conservative. These are estimates, not promises.",
    "",
    "Today: " + today.toISOString().slice(0, 10),
    "Shop link: " + report.shop_url,
    "Pinterest profile link given by seller (not read, reference only): " + (report.pinterest_url || "none"),
    "Seller says they sell: " + (report.product_note || "not given"),
    "Seller chose niche: " + (report.niche || "let AI decide"),
    "Main buyer country: " + (report.country || "United States"),
    "",
    "What we could read from the shop (" + shop.source + "):",
    shop.summary.slice(0, 6000),
    "",
    // Pinterest data is NEVER sent to the AI (privacy policy promise). The server adds the
    // seller's real current views on top of this forecast in cleanResult().
    analytics ? "The seller's current Pinterest views are added by our own system and are not shared with you. Forecast only the EXTRA monthly views that consistent optimized pins would add, starting from zero." :
      "No Pinterest analytics connected. Assume the account starts near zero views unless the shop data clearly shows an established brand.",
    "",
    BENCHMARKS,
    "",
    "Return ONLY valid JSON, no other text, in exactly this shape:",
    "{",
    "  \"shop_name\": \"short shop or brand name\",",
    "  \"niche\": \"one of: Home Decor, Jewelry, Engagement Rings, Fashion, Health and Wellness, Digital Products, Crafts and Patterns, Other\",",
    "  \"summary\": \"2 sentences on what the shop sells and how it fits Pinterest\",",
    "  \"audience\": \"one sentence on the best Pinterest audience\",",
    "  \"strategy\": \"one of: trend, gift, evergreen, hook, lifestyle\",",
    "  \"strategy_reason\": \"one sentence why\",",
    "  \"pins_per_day\": 2,",
    "  \"start_daily_views\": 0,",
    "  \"months\": [ {\"month\":1,\"worst\":0,\"avg\":0,\"best\":0}, ... 6 items, total views in each month ],",
    "  \"insights\": [\"3 to 4 short, specific observations about this shop's Pinterest potential\"],",
    "  \"risks\": [\"2 short things that could hold growth back\"],",
    "  \"first_steps\": [\"3 short concrete actions for the first 2 weeks\"],",
    "  \"confidence\": \"low, medium or high\"",
    "}",
    "Rules: worst <= avg <= best every month. Use plain ASCII only, no emojis. Do not promise sales."
  ].join("\n");
}

async function callClaude(prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: REPORT_MODEL, max_tokens: 2500, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(50000)
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const e = new Error("AI error " + r.status);
    e.detail = data;
    throw e;
  }
  return (data.content || []).filter(function (b) { return b.type === "text"; }).map(function (b) { return b.text; }).join("\n");
}

const NICHES = ["Home Decor", "Jewelry", "Engagement Rings", "Fashion", "Health and Wellness", "Digital Products", "Crafts and Patterns", "Other"];
const STRATS = ["trend", "gift", "evergreen", "hook", "lifestyle"];

export function cleanResult(raw, analytics) {
  const t = String(raw || "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("AI did not return JSON");
  const j = JSON.parse(t.slice(a, b + 1));
  const num = function (v) { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n) : 0; };
  let months = Array.isArray(j.months) ? j.months.slice(0, 6) : [];
  if (months.length < 6) throw new Error("AI returned fewer than 6 months");
  // Real current monthly views (computed on our server, never seen by the AI).
  // The AI forecasts only the extra views, so we add this base on top.
  const base = analytics ? analytics.last30 : 0;
  months = months.map(function (m, i) {
    let avg = Math.min(num(m.avg), 5000000);
    let worst = num(m.worst), best = num(m.best);
    if (base) {
      avg = avg + base;
      worst = worst + Math.round(base * 0.7);
      best = best + Math.round(base * 1.3);
    }
    if (!worst || worst > avg) worst = Math.round(avg * 0.45);
    if (worst < avg * 0.15) worst = Math.round(avg * 0.15);
    if (!best || best < avg) best = Math.round(avg * 2);
    if (best > avg * 4) best = Math.round(avg * 4);
    return { month: i + 1, worst: worst, avg: avg, best: best };
  });
  const list = function (x, n) { return (Array.isArray(x) ? x : []).map(asciiOnly).filter(Boolean).slice(0, n).map(function (s) { return s.slice(0, 240); }); };
  let ppd = parseInt(j.pins_per_day, 10);
  if (!(ppd >= 1)) ppd = 2;
  if (ppd > 10) ppd = 10;
  return {
    shop_name: asciiOnly(j.shop_name).slice(0, 80),
    niche: NICHES.indexOf(j.niche) > -1 ? j.niche : "Other",
    summary: asciiOnly(j.summary).slice(0, 500),
    audience: asciiOnly(j.audience).slice(0, 300),
    strategy: STRATS.indexOf(j.strategy) > -1 ? j.strategy : "trend",
    strategy_reason: asciiOnly(j.strategy_reason).slice(0, 300),
    pins_per_day: ppd,
    start_daily_views: analytics ? analytics.avg7 : Math.min(num(j.start_daily_views), 100000),
    months: months,
    insights: list(j.insights, 4),
    risks: list(j.risks, 3),
    first_steps: list(j.first_steps, 3),
    confidence: ["low", "medium", "high"].indexOf(j.confidence) > -1 ? j.confidence : "medium"
  };
}

// Generates the AI result for a report row and saves it. Never throws.
export async function generateReport(report) {
  try {
    await db("growth_reports?id=eq." + report.id, { method: "PATCH", body: { status: "processing", attempts: (report.attempts || 0) + 1 } });
    const shop = await readShop(report.shop_url);
    let analytics = null;
    if (Array.isArray(report.history) && report.history.length >= 7) {
      const h = report.history.map(function (v) { return Number(v) || 0; });
      const sum = function (arr) { return arr.reduce(function (x, y) { return x + y; }, 0); };
      analytics = { days: h.length, total: sum(h), last30: sum(h.slice(-30)), avg7: Math.round(sum(h.slice(-7)) / 7) };
    }
    const raw = await callClaude(buildPrompt(report, shop, analytics, new Date()));
    const result = cleanResult(raw, analytics);
    result.source = shop.source;
    await db("growth_reports?id=eq." + report.id, {
      method: "PATCH",
      body: { status: "ready", result: result, niche: result.niche, generated_at: new Date().toISOString(), error: null }
    });
    return Object.assign({}, report, { status: "ready", result: result });
  } catch (e) {
    console.error("generateReport", report.id, e.message, JSON.stringify(e.detail || {}).slice(0, 500));
    try {
      await db("growth_reports?id=eq." + report.id, { method: "PATCH", body: { status: "failed", error: String(e.message || e).slice(0, 300) } });
    } catch (e2) { /* ignore */ }
    return Object.assign({}, report, { status: "failed" });
  }
}

// What the browser is allowed to see. The result stays hidden until ready_at.
export function publicReport(r) {
  const revealed = r.status === "ready" && Date.now() >= new Date(r.ready_at).getTime();
  return {
    id: r.id,
    shop_url: r.shop_url,
    pinterest_url: r.pinterest_url,
    created_at: r.created_at,
    ready_at: r.ready_at,
    status: revealed ? "ready" : (r.status === "failed" && (r.attempts || 0) >= 3 ? "failed" : "waiting"),
    has_history: Array.isArray(r.history) && r.history.length > 0,
    history: revealed && Array.isArray(r.history) ? r.history.slice(-45) : [],
    result: revealed ? r.result : null
  };
}

export { clip };
