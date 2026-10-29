// GET /api/report/get?id=...  one report (only your own)
// GET /api/report/get          your reports, newest first
// If a report failed or never finished and its time has come, it is built again here.

import { sendJson } from "../../lib.js";
import { getUser, db, generateReport, publicReport } from "../../app.js";

function needsWork(r) {
  if (r.status === "ready") return false;
  if ((r.attempts || 0) >= 3) return false;
  if (r.status === "processing") return Date.now() - new Date(r.created_at).getTime() > 10 * 60000;
  return true; // queued or failed
}

export default async function handler(req, res) {
  try {
    const u = getUser(req);
    if (!u) return sendJson(res, 401, { error: "Log in to see your reports." });
    const url = new URL(req.url, "http://localhost");
    const id = (url.searchParams.get("id") || "").replace(/[^0-9a-f-]/gi, "");

    if (id) {
      const rows = await db("growth_reports?id=eq." + id + "&user_id=eq." + u.id + "&select=*");
      if (!rows.length) return sendJson(res, 404, { error: "Report not found." });
      let r = rows[0];
      if (needsWork(r) && Date.now() >= new Date(r.ready_at).getTime() - 30 * 60000) r = await generateReport(r);
      return sendJson(res, 200, { report: publicReport(r) });
    }

    const rows = await db("growth_reports?user_id=eq." + u.id + "&select=*&order=created_at.desc&limit=10");
    sendJson(res, 200, { reports: rows.map(publicReport) });
  } catch (e) {
    console.error(e, JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: "Could not load your report. Please try again." });
  }
}
