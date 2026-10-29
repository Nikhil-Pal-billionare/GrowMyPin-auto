// GET /api/user/home  data for the personal home page (home.html):
// profile + shop links, Pinterest pins, last 30 days Pinterest views, settings.
//
// Pins come from:
//   1. the official Pinterest API, when the person connected Pinterest (best, real data)
//   2. otherwise the public RSS feed of the Pinterest profile link they gave
//      (pinterest.com/<name>/feed.rss) - only if "pins_from_profile_link" is on in Admin > Settings

import { sendJson, getSession, pinterest } from "../../lib.js";
import { getUser, db } from "../../app.js";
import { getProfile, upsertProfile } from "../../growth.js";
import { getSettings, publicSettings } from "../../settings.js";

function ymd(d) { return d.toISOString().slice(0, 10); }

function decode(s) {
  return String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

function asciiText(s, max) {
  let out = "";
  for (const ch of String(s || "")) { const c = ch.charCodeAt(0); out += c >= 32 && c <= 126 ? ch : (c === 10 ? " " : ""); }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

export function pinterestUser(link) {
  try {
    const u = new URL(String(link));
    if (!/(^|\.)pinterest\.[a-z.]+$/i.test(u.hostname)) return "";
    const first = u.pathname.split("/").filter(Boolean)[0] || "";
    if (!first || ["pin", "search", "ideas", "today", "business", "_", "settings"].indexOf(first.toLowerCase()) > -1) return "";
    return /^[A-Za-z0-9_.-]{2,40}$/.test(first) ? first : "";
  } catch (e) {
    return "";
  }
}

async function pinsFromApi(session) {
  const r = await pinterest(session, "/pins?page_size=15");
  if (!r.ok) return null;
  return (r.data.items || []).map(function (p) {
    const im = (p.media && p.media.images) || {};
    const img = (im["600x"] || im["400x300"] || im["1200x"] || im["150x150"] || {}).url || "";
    return { id: p.id, title: asciiText(p.title || p.description || "", 90), img: img, url: "https://www.pinterest.com/pin/" + p.id + "/" };
  }).filter(function (p) { return p.img; }).slice(0, 12);
}

async function pinsFromRss(username) {
  const r = await fetch("https://www.pinterest.com/" + encodeURIComponent(username) + "/feed.rss", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GrowMyPin/1.0)", "Accept": "application/rss+xml, application/xml, text/xml" },
    redirect: "follow",
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) return null;
  const xml = (await r.text()).slice(0, 600000);
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.map(function (it) {
    const title = decode((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const link = decode((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1]).trim();
    const desc = decode((it.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    let img = (desc.match(/src="(https:\/\/i\.pinimg\.com\/[^"]+)"/) || [])[1] || "";
    img = img.replace(/\/(75x75_RS|170x|236x)\//, "/474x/");
    return { id: link, title: asciiText(title, 90), img: img, url: /^https:\/\/([a-z]+\.)?pinterest\./.test(link) ? link : "" };
  }).filter(function (p) { return p.img; }).slice(0, 12);
}

export default async function handler(req, res) {
  try {
    const u = getUser(req);
    if (!u) return sendJson(res, 401, { error: "Please log in." });
    const settings = await getSettings();

    let p = await getProfile(u.id);
    if (!p) {
      await upsertProfile({ id: u.id, email: u.email, name: u.name, phone: u.whatsapp });
      p = await getProfile(u.id) || { offer_status: "pending" };
    }

    // Pinterest
    const pin = { connected: false, username: "", source: "", pins: [], views30: null, pin_count: null, link_user: pinterestUser(p.pinterest_url) };
    let session = null;
    try { session = await getSession(req, res); } catch (e) { session = null; }
    if (session) {
      try {
        const results = await Promise.all([
          pinterest(session, "/user_account"),
          pinsFromApi(session),
          pinterest(session, "/user_account/analytics?start_date=" + ymd(new Date(Date.now() - 30 * 86400000)) + "&end_date=" + ymd(new Date()) + "&metric_types=IMPRESSION")
        ]);
        if (results[0].ok) {
          pin.connected = true;
          pin.username = results[0].data.username || "";
          if (results[0].data.pin_count != null) pin.pin_count = Number(results[0].data.pin_count) || 0;
        }
        if (results[1] && results[1].length) { pin.pins = results[1]; pin.source = "api"; }
        if (results[2] && results[2].ok) {
          const sm = (results[2].data.all && results[2].data.all.summary_metrics) || {};
          pin.views30 = Number(sm.IMPRESSION || 0);
        }
      } catch (e) { /* Pinterest not reachable: fall back below */ }
    }
    if (!pin.pins.length && pin.link_user && settings.pins_from_profile_link) {
      try {
        const rss = await pinsFromRss(pin.link_user);
        if (rss && rss.length) { pin.pins = rss; pin.source = "profile"; pin.rss_count = rss.length; }
      } catch (e) { /* profile private, renamed or Pinterest blocked the request */ }
    }

    // keep the last real Pinterest numbers on the profile (popup + admin use them). Best effort.
    if (pin.connected && (pin.pin_count != null || pin.views30 != null)) {
      const old = p.pin_stats || {};
      if (old.pins !== pin.pin_count || old.views30 !== pin.views30) {
        db("profiles?id=eq." + u.id, {
          method: "PATCH",
          body: { pin_stats: { pins: pin.pin_count, views30: pin.views30, at: new Date().toISOString() } },
          prefer: "return=minimal"
        }).catch(function () { /* v1.3 SQL not run yet */ });
      }
    }

    res.setHeader("Cache-Control", "private, no-store");
    sendJson(res, 200, {
      user: { name: p.name || u.name || "", email: u.email, phone: p.phone || u.whatsapp || "" },
      profile: {
        offer_status: p.offer_status || "pending",
        platforms: p.platforms || [],
        links: p.shop_links || {},
        pinterest_url: p.pinterest_url || "",
        target: p.target_sales || 0,
        wait: p.wait_months || 0,
        interest_at: p.interest_at || null,
        niche: p.niche || "",
        pins_count: p.pins_count == null ? null : p.pins_count,
        pin_stats: p.pin_stats || null,
        created_at: p.created_at || null
      },
      pinterest: pin,
      settings: publicSettings(settings)
    });
  } catch (e) {
    console.error("home", e.message, JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: "Could not load your home page. Please refresh." });
  }
}
