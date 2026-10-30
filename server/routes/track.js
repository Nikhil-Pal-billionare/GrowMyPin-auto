// POST /api/track  { vid, sid, path, ref, kind }
// Light first-party visitor counter for the admin panel (visitors, sessions, bounce rate).
// kind: "view" (page opened), "engage" (stayed 10+ seconds or clicked something),
//       "human" (real mouse movement, scroll, tap or key press - bots almost never do this).
// Real people vs bots (v1.5): a visitor counts as a REAL person only if they did a "human" action
// and showed no automated-browser signal. Admin > Dashboard shows Real / Bots / You and team separately.
// No cookies, no IP address stored.

import { getUser, db } from "../app.js";
import { isAdminEmail } from "../growth.js";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|node-fetch|axios|phantom|puppeteer|playwright|selenium|webdriver|scrapy|httpclient|okhttp|java\/|go-http|uptime|scanner|inspect|validator|prerender|vercel|screenshot|chrome-lighthouse|google-?other|bingpreview|yandex|baidu|semrush|ahrefs|mj12|dataforseo|petal|bytespider|gptbot|claude|ccbot|perplexity/i;

// admin check is cached for 10 minutes per user so tracking stays fast
const staffCache = {};
async function isStaff(u) {
  if (!u || !u.email) return false;
  const k = String(u.email).toLowerCase(), c = staffCache[k];
  if (c && Date.now() - c.t < 600000) return c.v;
  let v = false;
  try { v = (await isAdminEmail(k)).admin; } catch (e) { v = false; }
  staffCache[k] = { v: v, t: Date.now() };
  return v;
}

// signals of an automated browser (headless Chrome, scripts, crawlers that run JavaScript)
function botSignals(req, ua, b) {
  if (BOT.test(ua)) return true;
  if (b.wd === true) return true;                                   // navigator.webdriver
  if (!req.headers["accept-language"]) return true;                 // real browsers always send it
  const sw = Number(b.sw) || 0, sh = Number(b.sh) || 0;
  if (b.sw !== undefined && (sw < 200 || sh < 200)) return true;    // no real screen
  if (sw === 800 && sh === 600) return true;                        // default headless window
  if (b.lang === 0) return true;                                    // no browser languages
  return false;
}

function idOf(s) {
  const v = String(s || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return v.length >= 8 ? v : "";
}

function deviceOf(ua) {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobi|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

function refHost(ref, host) {
  try {
    const h = new URL(String(ref)).hostname.replace(/^www\./, "").toLowerCase();
    if (!h || h === String(host || "").replace(/^www\./, "").toLowerCase()) return null;
    return h.slice(0, 120);
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.statusCode = 204;
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.end();
    const ua = String(req.headers["user-agent"] || "");
    if (!ua) return res.end();
    let b = req.body || {};
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const vid = idOf(b.vid), sid = idOf(b.sid);
    if (!vid || !sid) return res.end();
    const kind = b.kind === "engage" ? "engage" : (b.kind === "human" ? "human" : "view");
    let path = String(b.path || "/").split("?")[0].split("#")[0].slice(0, 160);
    if (path.charAt(0) !== "/") path = "/" + path;
    const u = getUser(req);
    const staff = b.staff === true || await isStaff(u);
    const bot = !staff && botSignals(req, ua, b);
    const tz = String(b.tz || "").replace(/[^A-Za-z0-9_\/+-]/g, "").slice(0, 40) || null;
    const row = {
        vid: vid, sid: sid, kind: kind, path: path,
        ref: kind === "view" ? refHost(b.ref, req.headers.host) : null,
        country: String(req.headers["x-vercel-ip-country"] || "").slice(0, 4) || null,
        device: deviceOf(ua),
        user_id: u ? u.id : null
    };
    try {
      await db("page_views", { method: "POST", prefer: "return=minimal", body: Object.assign({ bot: bot, staff: staff, tz: tz }, row) });
    } catch (e) {
      // database without the v1.5 columns yet: save the old way
      await db("page_views", { method: "POST", prefer: "return=minimal", body: row });
    }
  } catch (e) {
    console.error("track", e.message);
  }
  res.end();
}
