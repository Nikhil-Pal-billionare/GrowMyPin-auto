// Disconnect Pinterest in this browser (keeps the GrowMyPin account logged in).

import { clearSession, redirect } from "../../lib.js";

export default function handler(req, res) {
  clearSession(res);
  redirect(res, "/app.html");
}
