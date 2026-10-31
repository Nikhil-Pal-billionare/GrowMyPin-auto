// POST /api/user/hub  { action: ... }
//   offer    { choice: "reserved" | "regret" }         Diwali banner answer
//   reserve  { platforms, target_sales, wait_months,    "Reserve my slot" form
//              links, has_pinterest, pinterest_url, phone }
//   shop     { platforms, links, pinterest_url }         home page: save shop details
//   interest { source }                                 "I want to increase visits"
//   growth   { niche, pins_count }                      personal growth graph (what they sell, pins on Pinterest)
//   goal     { target_sales }                           profile page: monthly sales goal
//   seen     { ids: [...] }                             mark GrowMyPin messages as read
//   push     { subscription }                           save this phone/browser for notifications
//   unpush   { endpoint }                               remove it

import { sendJson } from "../../lib.js";
import { getUser, db, cleanPhone } from "../../app.js";
import { PLATFORMS, TARGETS, WAITS, cleanUrl, nowIso, getProfile, upsertProfile } from "../../growth.js";
import { getSettings } from "../../settings.js";

function uuidList(arr) {
  return (Array.isArray(arr) ? arr : []).map(function (x) { return String(x).replace(/[^0-9a-f-]/gi, ""); })
    .filter(function (x) { return x.length >= 32 && x.length <= 40; }).slice(0, 20);
}

// niche must be one of the niches in Admin > Growth graph
async function validNiche(v) {
  const want = String(v || "").trim().toLowerCase();
  if (!want) return "";
  const st = await getSettings();
  const list = (st.growth && st.growth.niches) || [];
  for (const n of list) if (n.name.toLowerCase() === want) return n.name;
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const u = getUser(req);
    if (!u) return sendJson(res, 401, { error: "Please log in again." });
    const b = req.body || {};
    const action = String(b.action || "");

    // make sure the profile row exists (older accounts)
    let profile = await getProfile(u.id);
    if (!profile) {
      await upsertProfile({ id: u.id, email: u.email, name: u.name, phone: u.whatsapp });
      profile = { offer_status: "pending" };
    }

    if (action === "offer") {
      const choice = b.choice === "reserved" ? "reserved" : "regret";
      // never move a finished reservation back
      if (profile.offer_status !== "submitted") {
        await db("profiles?id=eq." + u.id, { method: "PATCH", body: { offer_status: choice, offer_at: nowIso() }, prefer: "return=minimal" });
      }
      return sendJson(res, 200, { ok: true, offer: profile.offer_status === "submitted" ? "submitted" : choice });
    }

    if (action === "reserve") {
      const platforms = (Array.isArray(b.platforms) ? b.platforms : []).map(String).filter(function (p, i, a) {
        return PLATFORMS.indexOf(p) > -1 && a.indexOf(p) === i;
      });
      const target = Number(b.target_sales);
      const wait = Number(b.wait_months);
      const phone = cleanPhone(b.phone);
      if (!platforms.length) return sendJson(res, 400, { error: "Pick where you sell: Etsy, eBay or Shopify." });
      if (TARGETS.indexOf(target) < 0) return sendJson(res, 400, { error: "Pick how many sales you want per month." });
      if (WAITS.indexOf(wait) < 0) return sendJson(res, 400, { error: "Pick how long you can wait." });
      if (!phone) return sendJson(res, 400, { error: "Add a valid phone number with country code, for example +91 98765 43210." });

      const links = {};
      const rawLinks = b.links && typeof b.links === "object" ? b.links : {};
      platforms.forEach(function (p) {
        const v = cleanUrl(rawLinks[p]);
        if (v) links[p] = v;
      });
      const hasPin = b.has_pinterest === true ? true : (b.has_pinterest === false ? false : null);
      const pinUrl = hasPin ? cleanUrl(b.pinterest_url) : "";

      const rows = await db("slot_reservations", {
        method: "POST",
        body: {
          user_id: u.id, email: u.email, name: u.name || profile.name || null, phone: phone,
          platforms: platforms, target_sales: target, wait_months: wait, links: links,
          has_pinterest: hasPin, pinterest_url: pinUrl || null
        }
      });
      await db("profiles?id=eq." + u.id, {
        method: "PATCH",
        body: {
          offer_status: "submitted", phone: phone, offer_at: nowIso(),
          platforms: platforms, shop_links: links, pinterest_url: pinUrl || null,
          target_sales: target, wait_months: wait
        },
        prefer: "return=minimal"
      });
      // niche is saved on its own, so an old database without the v1.3 column never breaks the form
      const niche = await validNiche(b.niche);
      if (niche) {
        db("profiles?id=eq." + u.id, { method: "PATCH", body: { niche: niche }, prefer: "return=minimal" }).catch(function (e) { console.error("niche", e.message); });
      }
      return sendJson(res, 200, { ok: true, id: rows && rows[0] ? rows[0].id : null, links: links });
    }

    // Home page: add or change shop links / Pinterest link
    if (action === "shop") {
      const platforms = (Array.isArray(b.platforms) ? b.platforms : []).map(String).filter(function (p, i, a) {
        return PLATFORMS.indexOf(p) > -1 && a.indexOf(p) === i;
      });
      const rawLinks = b.links && typeof b.links === "object" ? b.links : {};
      const links = {};
      let bad = false;
      PLATFORMS.forEach(function (p) {
        if (rawLinks[p] === undefined || rawLinks[p] === "") return;
        const v = cleanUrl(rawLinks[p]);
        if (v) links[p] = v; else bad = true;
      });
      if (bad) return sendJson(res, 400, { error: "One shop link does not look right. Check it and try again." });
      Object.keys(links).forEach(function (p) { if (platforms.indexOf(p) < 0) platforms.push(p); });
      let pinUrl = null;
      if (b.pinterest_url) {
        pinUrl = cleanUrl(b.pinterest_url);
        if (!pinUrl || !/(^|\.)pinterest\./i.test(new URL(pinUrl).hostname)) {
          return sendJson(res, 400, { error: "The Pinterest link should look like pinterest.com/yourname" });
        }
      }
      const body = { platforms: platforms, shop_links: links };
      if (b.pinterest_url !== undefined) body.pinterest_url = pinUrl;
      if (TARGETS.indexOf(Number(b.target_sales)) > -1) body.target_sales = Number(b.target_sales);
      await db("profiles?id=eq." + u.id, { method: "PATCH", body: body, prefer: "return=minimal" });
      return sendJson(res, 200, { ok: true, platforms: platforms, links: links, pinterest_url: pinUrl });
    }

    // "I want to increase visits" (popup or home page) = hot lead for the admin panel
    if (action === "interest") {
      const src = ["popup", "home", "graph"].indexOf(b.source) > -1 ? b.source : "home";
      await db("profiles?id=eq." + u.id, {
        method: "PATCH",
        body: { interest_at: nowIso(), interest_count: (profile.interest_count || 0) + 1, interest_source: src },
        prefer: "return=minimal"
      });
      const st = await getSettings();
      return sendJson(res, 200, { ok: true, whatsapp: st.sales_whatsapp || "" });
    }

    // Personal growth graph: what they sell + how many pins are on their Pinterest
    if (action === "growth") {
      const body = {};
      if (b.niche !== undefined) {
        const niche = await validNiche(b.niche);
        if (!niche) return sendJson(res, 400, { error: "Pick what you sell from the list." });
        body.niche = niche;
      }
      if (b.pins_count !== undefined && b.pins_count !== null && b.pins_count !== "") {
        const n = Math.round(Number(b.pins_count));
        if (!(n >= 0 && n <= 1000000)) return sendJson(res, 400, { error: "Pins must be a number." });
        body.pins_count = n;
      }
      if (!Object.keys(body).length) return sendJson(res, 400, { error: "Nothing to save." });
      try {
        await db("profiles?id=eq." + u.id, { method: "PATCH", body: body, prefer: "return=minimal" });
      } catch (e) {
        console.error("growth save", e.message, JSON.stringify(e.detail || {}));
        return sendJson(res, 500, { error: "Could not save. (Admin: run the v1.3 part of supabase.sql.)" });
      }
      return sendJson(res, 200, Object.assign({ ok: true }, body));
    }

    // Profile page: monthly sales goal (one of TARGETS)
    if (action === "goal") {
      const target = Number(b.target_sales);
      if (TARGETS.indexOf(target) < 0) return sendJson(res, 400, { error: "Pick how many sales you want per month." });
      await db("profiles?id=eq." + u.id, { method: "PATCH", body: { target_sales: target }, prefer: "return=minimal" });
      return sendJson(res, 200, { ok: true, target_sales: target });
    }

    if (action === "seen") {
      const ids = uuidList(b.ids);
      if (ids.length) {
        await db("user_messages?user_id=eq." + u.id + "&id=in.(" + ids.join(",") + ")&seen_at=is.null", {
          method: "PATCH", body: { seen_at: nowIso() }, prefer: "return=minimal"
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    if (action === "push") {
      const s = b.subscription || {};
      const keys = s.keys || {};
      const endpoint = String(s.endpoint || "");
      if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !keys.p256dh || !keys.auth) {
        return sendJson(res, 400, { error: "Notification setup was not complete. Try again." });
      }
      await db("push_subscriptions?on_conflict=endpoint", {
        method: "POST",
        body: {
          user_id: u.id, endpoint: endpoint,
          p256dh: String(keys.p256dh).slice(0, 200), auth: String(keys.auth).slice(0, 100),
          ua: String(req.headers["user-agent"] || "").slice(0, 200), updated_at: nowIso()
        },
        prefer: "resolution=merge-duplicates,return=minimal"
      });
      return sendJson(res, 200, { ok: true });
    }

    if (action === "unpush") {
      const endpoint = String(b.endpoint || "");
      if (endpoint) {
        await db("push_subscriptions?user_id=eq." + u.id + "&endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE", prefer: "return=minimal" });
      }
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 400, { error: "Unknown action" });
  } catch (e) {
    console.error(e, JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: "Could not save. Please try again." });
  }
}
