// Log out of the GrowMyPin account (does not disconnect Pinterest).

import { sendJson } from "../../lib.js";
import { clearUser } from "../../app.js";

export default function handler(req, res) {
  clearUser(res);
  sendJson(res, 200, { ok: true });
}
