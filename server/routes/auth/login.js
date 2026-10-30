// Step 1 of OAuth: send the user to Pinterest to grant consent.

import crypto from "crypto";
import { SCOPES, STATE_COOKIE, cookieStr, addCookie, redirectUri, redirect } from "../../lib.js";

// Where to send people back to (same site paths only).
function safeNext(req) {
  const next = new URL(req.url, "http://localhost").searchParams.get("next") || "";
  return /^\/[A-Za-z0-9_.\-\/?=&]*$/.test(next) && next.indexOf("//") === -1 ? next : "";
}

// Pinterest app not set up yet (or API access still pending): never show a raw error.
// Send the person back with ?pinterest=soon, the page shows a friendly message.
function notReady(req, res) {
  const back = safeNext(req) || "/home.html";
  redirect(res, back + (back.indexOf("?") > -1 ? "&" : "?") + "pinterest=soon");
}

export default function handler(req, res) {
  if (!process.env.PINTEREST_APP_ID || !process.env.PINTEREST_APP_SECRET || !process.env.PINTEREST_REDIRECT_URI) {
    console.error("Pinterest connect: PINTEREST_APP_ID / PINTEREST_APP_SECRET / PINTEREST_REDIRECT_URI missing in Vercel env");
    return notReady(req, res);
  }
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
    const next = safeNext(req);
    if (next) addCookie(res, cookieStr("gmp_next", next, 600));
    redirect(res, "https://www.pinterest.com/oauth/?" + params.toString());
  } catch (e) {
    console.error("Pinterest connect", e.message);
    notReady(req, res);
  }
}
