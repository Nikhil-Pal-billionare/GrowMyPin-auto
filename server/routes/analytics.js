// Last 30 days account analytics (impressions, outbound clicks, saves, pin clicks).
// This is the number GrowMyPin uses for view-based billing, read straight from Pinterest.

import { getSession, pinterest, sendJson } from "../lib.js";

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    const s = await getSession(req, res);
    if (!s) return sendJson(res, 401, { error: "Not connected" });

    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const q = "/user_account/analytics?start_date=" + ymd(start) +
      "&end_date=" + ymd(end) +
      "&metric_types=IMPRESSION,OUTBOUND_CLICK,SAVE,PIN_CLICK";

    const r = await pinterest(s, q);
    if (!r.ok) return sendJson(res, 502, { error: "Analytics not available", detail: r.data });

    const summary = (r.data.all && r.data.all.summary_metrics) || {};

    // Daily impressions for the last 89 days (feeds the growth forecast). Optional.
    let daily = [];
    try {
      const start89 = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
      const h = await pinterest(s, "/user_account/analytics?start_date=" + ymd(start89) + "&end_date=" + ymd(end) + "&metric_types=IMPRESSION");
      if (h.ok) {
        daily = ((h.data.all && h.data.all.daily_metrics) || [])
          .filter(function (d) { return d && d.date && d.metrics && d.data_status === "READY"; })
          .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
          .map(function (d) { return { date: d.date, impressions: Number(d.metrics.IMPRESSION || 0) }; });
      }
    } catch (e) { /* forecast falls back to benchmarks */ }

    sendJson(res, 200, {
      daily: daily,
      start_date: ymd(start),
      end_date: ymd(end),
      impressions: Number(summary.IMPRESSION || 0),
      outbound_clicks: Number(summary.OUTBOUND_CLICK || 0),
      saves: Number(summary.SAVE || 0),
      pin_clicks: Number(summary.PIN_CLICK || 0)
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
