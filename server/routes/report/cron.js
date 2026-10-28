// Background job. Run it every 10-15 minutes (Supabase pg_cron or cron-job.org) and daily on Vercel.
// 1) Builds reports that failed or never finished.  2) Emails people whose report is now ready.
// Protected by CRON_SECRET (Vercel sends it as a Bearer token; other schedulers can use ?key=).

import { sendJson } from "../../lib.js";
import { db, generateReport, sendEmail, readyEmail, siteUrl } from "../../app.js";

export default async function handler(req, res) {
  try {
    const secret = process.env.CRON_SECRET || "";
    const url = new URL(req.url, "http://localhost");
    const given = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || url.searchParams.get("key") || "";
    if (!secret || given !== secret) return sendJson(res, 401, { error: "Not allowed" });

    const out = { built: 0, emailed: 0, email_errors: 0 };
    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - 10 * 60000).toISOString();

    // 1) retry builds (max 2 per run so the job stays short)
    const todo = await db("growth_reports?select=*&attempts=lt.3&or=(status.in.(queued,failed),and(status.eq.processing,created_at.lt." + encodeURIComponent(staleIso) + "))&order=created_at.asc&limit=2");
    for (const r of todo) {
      const done = await generateReport(r);
      if (done.status === "ready") out.built++;
    }

    // 2) send "your report is ready" emails
    if (process.env.EMAIL_FROM) {
      const due = await db("growth_reports?select=*&status=eq.ready&emailed_at=is.null&ready_at=lte." + encodeURIComponent(nowIso) + "&order=ready_at.asc&limit=20");
      for (const r of due) {
        try {
          const mail = readyEmail(r, siteUrl(req) + "/report.html?id=" + r.id);
          await sendEmail(r.email, mail.subject, mail.html, mail.text);
          await db("growth_reports?id=eq." + r.id, { method: "PATCH", body: { emailed_at: new Date().toISOString() } });
          out.emailed++;
        } catch (e) {
          console.error("email", r.id, e.message);
          out.email_errors++;
        }
      }
    }
    sendJson(res, 200, out);
  } catch (e) {
    console.error(e, JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: e.message });
  }
}
