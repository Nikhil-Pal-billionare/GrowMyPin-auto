// Set a new password using the recovery token from the reset email link.

import { sendJson } from "../../lib.js";
import { sbAuth, setUser, authError } from "../../app.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  try {
    const b = req.body || {};
    const token = String(b.access_token || "");
    const password = String(b.password || "");
    if (!token) return sendJson(res, 400, { error: "This reset link is not valid. Ask for a new one." });
    if (password.length < 8) return sendJson(res, 400, { error: "Password must be at least 8 characters." });

    const r = await sbAuth("/user", { password: password }, { method: "PUT", token: token });
    if (!r.ok) return sendJson(res, 400, { error: r.status === 401 ? "This reset link has expired. Ask for a new one." : authError(r.data) });

    const meta = r.data.user_metadata || {};
    const u = setUser(res, { id: r.data.id, email: r.data.email, name: meta.name, whatsapp: meta.whatsapp });
    sendJson(res, 200, { user: { email: u.email, name: u.name } });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message });
  }
}
