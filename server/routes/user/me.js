// Who is logged in, whether Pinterest is connected in this browser, offer status,
// admin flag and unread messages from GrowMyPin.
// ?lite=1 skips the Pinterest call (used by /gmp.js on every page).
// ?msg=<id> also returns that one message even if it was already seen.

import { sendJson, getSession, pinterest } from "../../lib.js";
import { getUser, refreshUser, db } from "../../app.js";
import { getProfile, isAdminEmail, vapidPublic, nowIso } from "../../growth.js";
import { getSettings, publicSettings } from "../../settings.js";
import { billingState } from "../../billing.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const lite = url.searchParams.get("lite") === "1";
    const msgId = (url.searchParams.get("msg") || "").replace(/[^0-9a-f-]/gi, "").slice(0, 40);
    const u = refreshUser(req, res) || getUser(req);

    let pin = null;
    if (!lite) {
      try {
        const s = await getSession(req, res);
        if (s) {
          const a = await pinterest(s, "/user_account");
          if (a.ok) pin = { username: a.data.username };
        }
      } catch (e) { /* Pinterest not configured or not connected */ }
    }

    const settings = publicSettings(await getSettings());
    if (!u) return sendJson(res, 200, { user: null, pinterest: pin, settings: settings });

    let offer = "pending";
    let growth = null;
    let billing = null;
    let messages = [];
    let admin = { admin: false, isSuper: false };
    try {
      const results = await Promise.all([
        getProfile(u.id),
        db("user_messages?select=id,title,body,image_url,created_at,seen_at&user_id=eq." + u.id +
          (msgId ? "&or=(seen_at.is.null,id.eq." + msgId + ")" : "&seen_at=is.null") +
          "&order=created_at.desc&limit=5").catch(function () { return []; }),
        isAdminEmail(u.email)
      ]);
      const p = results[0];
      if (p) {
        offer = p.offer_status || "pending";
        billing = billingState(p);
        growth = {
          platforms: p.platforms || [], links: p.shop_links || {}, pinterest_url: p.pinterest_url || "",
          has_pinterest: !!p.pinterest_url, target: p.target_sales || 0, wait: p.wait_months || 0,
          niche: p.niche || "", pins_count: p.pins_count == null ? null : p.pins_count,
          pin_stats: p.pin_stats || null
        };
      }
      messages = results[1] || [];
      admin = results[2];
      // remember when we last saw this person (at most every 10 minutes)
      if (p && (!p.last_seen_at || Date.now() - new Date(p.last_seen_at).getTime() > 600000)) {
        db("profiles?id=eq." + u.id, { method: "PATCH", body: { last_seen_at: nowIso() }, prefer: "return=minimal" }).catch(function () {});
      }
    } catch (e) {
      console.error("me extras", e.message);
    }

    sendJson(res, 200, {
      user: { email: u.email, name: u.name, whatsapp: u.whatsapp },
      pinterest: pin,
      offer: offer,
      is_admin: admin.admin,
      is_super: admin.isSuper,
      messages: messages,
      growth: growth,
      billing: billing,
      settings: settings,
      vapid: vapidPublic()
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
