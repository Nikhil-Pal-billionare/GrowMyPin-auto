// Step 2 of OAuth: Pinterest sends the user back here with a code.

import {
  STATE_COOKIE, parseCookies, cookieStr, addCookie, tokenRequest,
  toSession, setSession, redirectUri, redirect
} from "../../lib.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Clear the one-time state cookie in every case.
  addCookie(res, cookieStr(STATE_COOKIE, "", 0));

  if (error) return redirect(res, "/app.html?error=denied");

  const saved = parseCookies(req)[STATE_COOKIE];
  if (!code || !state || !saved || saved !== state) {
    return redirect(res, "/app.html?error=state");
  }

  try {
    const data = await tokenRequest({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri()
    });
    if (!data) return redirect(res, "/app.html?error=token");
    setSession(res, toSession(data, null));
    const next = parseCookies(req).gmp_next || "";
    addCookie(res, cookieStr("gmp_next", "", 0));
    if (/^\/[A-Za-z0-9_.\-\/?=&]*$/.test(next) && next.indexOf("//") === -1) {
      return redirect(res, next + (next.indexOf("?") > -1 ? "&" : "?") + "connected=1");
    }
    return redirect(res, "/app.html?connected=1");
  } catch (e) {
    console.error(e);
    return redirect(res, "/app.html?error=server");
  }
}
