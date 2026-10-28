// Create an account (Supabase Auth), save the profile row and sign the user in.

import { sendJson } from "../../lib.js";
import { sbAuth, setUser, authError, cleanEmail, cleanPhone, clip } from "../../app.js";
import { isReservedEmail, upsertProfile } from "../../growth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const b = req.body || {};
    const name = clip(b.name, 80);
    const email = cleanEmail(b.email);
    const whatsapp = cleanPhone(b.whatsapp);
    const password = String(b.password || "");
    if (!name) return sendJson(res, 400, { error: "Add your name." });
    if (!email) return sendJson(res, 400, { error: "Add a valid email address." });
    if (!whatsapp) return sendJson(res, 400, { error: "Add a valid WhatsApp number with country code, for example +91 98765 43210." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });
    if (b.agree !== true) return sendJson(res, 400, { error: "Please agree to the Terms and Privacy Policy." });

    // Admin emails are created only inside Supabase, never from this public form.
    if (await isReservedEmail(email)) {
      return sendJson(res, 409, { error: "An account with this email already exists. Log in instead." });
    }

    const created = await sbAuth("/admin/users", {
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { name: name, whatsapp: whatsapp }
    }, { admin: true });
    if (!created.ok) return sendJson(res, created.status === 422 ? 409 : 400, { error: authError(created.data) });

    const id = created.data.id || (created.data.user && created.data.user.id);
    await upsertProfile({ id: id, email: email, name: name, phone: whatsapp, ref: b.ref, vid: b.vid });
    const u = setUser(res, { id: id, email: email, name: name, whatsapp: whatsapp });
    sendJson(res, 200, { user: { email: u.email, name: u.name, whatsapp: u.whatsapp }, offer: "pending" });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
