// Send a password reset email (sent by Supabase Auth).

import { sendJson } from "../../lib.js";
import { sbAuth, cleanEmail, siteUrl } from "../../app.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const email = cleanEmail((req.body || {}).email);
    if (!email) return sendJson(res, 400, { error: "Add a valid email address." });
    await sbAuth("/recover?redirect_to=" + encodeURIComponent(siteUrl(req) + "/reset.html"), { email: email });
    // Same reply whether or not the email exists, so accounts cannot be guessed.
    sendJson(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
