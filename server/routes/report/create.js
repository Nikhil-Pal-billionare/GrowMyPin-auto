// Start a free growth report: save the request, then ask the AI to build the forecast.
// The result is revealed to the user only after REPORT_DELAY_HOURS (default 4).

import { sendJson, getSession, pinterest, isHttpUrl } from "../../lib.js";
import { getUser, db, generateReport, publicReport, REPORT_DELAY_HOURS, clip } from "../../app.js";

const NICHES = ["Home Decor", "Jewelry", "Engagement Rings", "Fashion", "Health and Wellness", "Digital Products", "Crafts and Patterns", "Other"];
const COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "India", "United Arab Emirates", "Other"];

function ymd(d) { return d.toISOString().slice(0, 10); }

async function pinterestHistory(req, res) {
  try {
    const s = await getSession(req, res);
    if (!s) return null;
    const end = new Date(), start = new Date(end.getTime() - 89 * 86400000);
    const r = await pinterest(s, "/user_account/analytics?start_date=" + ymd(start) + "&end_date=" + ymd(end) + "&metric_types=IMPRESSION");
    if (!r.ok) return null;
    const daily = ((r.data && r.data.all && r.data.all.daily_metrics) || [])
      .filter(function (d) { return d && d.date && d.metrics && d.data_status === "READY"; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
      .map(function (d) { return Number(d.metrics.IMPRESSION || 0); });
    return daily.length ? daily : null;
  } catch (e) {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const u = getUser(req);
    if (!u) return sendJson(res, 401, { error: "Log in to get your free report." });

    const b = req.body || {};
    const shopUrl = clip(b.shop_url, 500);
    const pinUrl = clip(b.pinterest_url, 500);
    const note = clip(b.product_note, 300);
    const niche = NICHES.indexOf(b.niche) > -1 ? b.niche : "";
    const country = COUNTRIES.indexOf(b.country) > -1 ? b.country : "United States";

    if (!isHttpUrl(shopUrl)) return sendJson(res, 400, { error: "Add your Etsy, Shopify or store link, starting with https://" });
    if (pinUrl && !(isHttpUrl(pinUrl) && /pinterest\./i.test(new URL(pinUrl).hostname))) return sendJson(res, 400, { error: "The Pinterest link should be your Pinterest profile link, like https://www.pinterest.com/yourname" });
    if (!note) return sendJson(res, 400, { error: "Tell us in a few words what you sell." });

    const mine = await db("growth_reports?user_id=eq." + u.id + "&select=id,status,ready_at&order=created_at.desc&limit=10");
    if (mine.length >= 5) return sendJson(res, 429, { error: "You have reached the limit of 5 free reports. Message us on WhatsApp for more." });
    const now = Date.now();
    if (mine.some(function (r) { return new Date(r.ready_at).getTime() > now; })) {
      return sendJson(res, 409, { error: "Your current report is still being prepared. You can start a new one after it is ready." });
    }

    const history = await pinterestHistory(req, res);
    const rows = await db("growth_reports", {
      method: "POST",
      body: {
        user_id: u.id, email: u.email, name: u.name, whatsapp: u.whatsapp,
        shop_url: shopUrl, pinterest_url: pinUrl || null, product_note: note,
        niche: niche || null, country: country,
        status: "queued", attempts: 0, history: history,
        ready_at: new Date(now + REPORT_DELAY_HOURS * 3600000).toISOString()
      }
    });
    const row = rows[0];
    // Build the report now. If this fails or times out, the cron job and the report page retry it.
    const done = await generateReport(row);
    sendJson(res, 200, { report: publicReport(done) });
  } catch (e) {
    console.error(e, JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: "Could not start your report. Please try again." });
  }
}
