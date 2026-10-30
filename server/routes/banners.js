// GET /api/banners  public: the landing page carousel (Admin > Banners).
// Only banners that are on; offer banners only while the offer is live. {offer} {percent} filled in here.

import { sendJson } from "../lib.js";
import { getSettings, publicSettings } from "../settings.js";

export default async function handler(req, res) {
  try {
    const s = await getSettings();
    const live = publicSettings(s);
    const b = s.banners || { enabled: false, items: [] };
    function fill(t) {
      return String(t || "").replace(/\{offer\}/g, s.offer_name || "Offer").replace(/\{percent\}/g, String(s.offer_percent || ""));
    }
    const items = !b.enabled ? [] : b.items.filter(function (x) {
      return x.on && (!x.offer_only || live.offer_active);
    }).map(function (x) {
      return { id: x.id, theme: x.theme, kicker: fill(x.kicker), title: fill(x.title), text: fill(x.text), btn: fill(x.btn), link: x.link, image: x.image };
    });
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ interval: b.interval || 5, items: items, offer_end: live.offer_active ? s.offer_end : null, showcase: (s.showcase && s.showcase.items) || [] }));
  } catch (e) {
    console.error("banners", e.message);
    sendJson(res, 200, { interval: 5, items: [] });
  }
}
