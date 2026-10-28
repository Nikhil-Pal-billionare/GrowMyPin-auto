// Log in with email + password (Supabase Auth).

import { sendJson } from "../../lib.js";
import { sbAuth, setUser, authError, cleanEmail } from "../../app.js";
import { upsertProfile, getProfile, isAdminEmail } from "../../growth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const b = req.body || {};
    const email = cleanEmail(b.email);
    const password = String(b.password || "");
    if (!email) return sendJson(res, 400, { error: "Add a valid email address." });
    if (!password) return sendJson(res, 400, { error: "Add your password." });

    const r = await sbAuth("/token?grant_type=password", { email: email, password: password });
    if (!r.ok || !r.data || !r.data.user) {
      return sendJson(res, r.status === 429 ? 429 : 401, { error: authError(r.data) });
    }
    const user = r.data.user;
    const meta = user.user_metadata || {};
    const u = setUser(res, { id: user.id, email: user.email, name: meta.name || "", whatsapp: meta.whatsapp || "" });

    const existing = await getProfile(user.id);
    await upsertProfile({
      id: user.id,
      email: user.email,
      name: existing && existing.name ? null : meta.name,
      phone: existing && existing.phone ? null : meta.whatsapp
    });
    const a = await isAdminEmail(user.email);

    sendJson(res, 200, {
      user: { email: u.email, name: u.name, whatsapp: u.whatsapp },
      offer: existing ? existing.offer_status : "pending",
      is_admin: a.admin
    });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
