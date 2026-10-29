// Per-pin results for pins published from the Studio, so the dashboard can show
// how much each strategy returned. POST { ids: ["pinId", ...] } (max 50).

import { getSession, pinterest, sendJson } from "../lib.js";

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const s = await getSession(req, res);
    if (!s) return sendJson(res, 401, { error: "Not connected" });

    const ids = ((req.body && req.body.ids) || [])
      .map(function (x) { return String(x || "").replace(/[^0-9A-Za-z_-]/g, ""); })
      .filter(Boolean)
      .slice(0, 50);
    if (!ids.length) return sendJson(res, 200, { stats: {} });

    const end = new Date();
    const start = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
    const qs = "?start_date=" + ymd(start) + "&end_date=" + ymd(end) +
      "&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,PIN_CLICK";

    const stats = {};
    // Small batches so we stay well inside Pinterest rate limits.
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      const results = await Promise.all(batch.map(function (id) {
        return pinterest(s, "/pins/" + id + "/analytics" + qs);
      }));
      results.forEach(function (r, j) {
        const id = batch[j];
        if (!r.ok) { stats[id] = { error: true }; return; }
        const all = (r.data && r.data.all) || {};
        let m = all.summary_metrics || all.lifetime_metrics || null;
        if (!m && Array.isArray(all.daily_metrics)) {
          m = {};
          all.daily_metrics.forEach(function (d) {
            Object.keys(d.metrics || {}).forEach(function (k) { m[k] = (m[k] || 0) + Number(d.metrics[k] || 0); });
          });
        }
        m = m || {};
        stats[id] = {
          impressions: Number(m.IMPRESSION || 0),
          outbound_clicks: Number(m.OUTBOUND_CLICK || 0),
          saves: Number(m.SAVE || 0),
          pin_clicks: Number(m.PIN_CLICK || 0)
        };
      });
    }
    sendJson(res, 200, { stats: stats });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
