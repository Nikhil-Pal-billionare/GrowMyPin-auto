// Step 1 of OAuth: send the user to Pinterest to grant consent.

import crypto from "crypto";
import { SCOPES, STATE_COOKIE, cookieStr, addCookie, redirectUri, redirect, sendJson } from "../../lib.js";

export default function handler(req, res) {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      client_id: process.env.PINTEREST_APP_ID || "",
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: SCOPES,
      state: state
    });
    addCookie(res, cookieStr(STATE_COOKIE, state, 600));
    // Optional page to return to after connecting (same site paths only).
    const next = new URL(req.url, "http://localhost").searchParams.get("next") || "";
    if (/^\/[A-Za-z0-9_.\-\/?=&]*$/.test(next) && next.indexOf("//") === -1) {
      addCookie(res, cookieStr("gmp_next", next, 600));
    }
    redirect(res, "https://www.pinterest.com/oauth/?" + params.toString());
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
}
