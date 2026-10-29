// POST /api/track  { vid, sid, path, ref, kind }
// Light first-party visitor counter for the admin panel (visitors, sessions, bounce rate).
// kind: "view" (page opened) or "engage" (stayed 10+ seconds or clicked something).
// No cookies, no IP address stored.

import { getUser, db } from "../app.js";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|node-fetch|axios/i;

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
    if (!ua || BOT.test(ua)) return res.end();
    let b = req.body || {};
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const vid = idOf(b.vid), sid = idOf(b.sid);
    if (!vid || !sid) return res.end();
    const kind = b.kind === "engage" ? "engage" : "view";
    let path = String(b.path || "/").split("?")[0].split("#")[0].slice(0, 160);
    if (path.charAt(0) !== "/") path = "/" + path;
    const u = getUser(req);
    await db("page_views", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        vid: vid, sid: sid, kind: kind, path: path,
        ref: kind === "view" ? refHost(b.ref, req.headers.host) : null,
        country: String(req.headers["x-vercel-ip-country"] || "").slice(0, 4) || null,
        device: deviceOf(ua),
        user_id: u ? u.id : null
      }
    });
  } catch (e) {
    console.error("track", e.message);
  }
  res.end();
}
