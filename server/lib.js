// Shared helpers for GrowMyPin Studio API routes.
// Files starting with "_" inside /api are NOT deployed as routes by Vercel.

import crypto from "crypto";

// OAuth always goes to production Pinterest.
export const OAUTH_BASE = "https://api.pinterest.com/v5";
// Pins / boards / analytics base. Set PINTEREST_API_BASE to
// https://api-sandbox.pinterest.com/v5 only if Pinterest tells you to use sandbox.
export const API_BASE = process.env.PINTEREST_API_BASE || "https://api.pinterest.com/v5";

export const SCOPES = "user_accounts:read,boards:read,pins:read,pins:write";

const SESSION_COOKIE = "gmp_session";
export const STATE_COOKIE = "gmp_state";

function secretKey() {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) {
    throw new Error("SESSION_SECRET env var missing or shorter than 16 characters");
  }
  return crypto.createHash("sha256").update(s).digest();
}

// Encrypt session (AES-256-GCM) so tokens are never readable in the browser.
export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function unseal(str) {
  try {
    const buf = Buffer.from(str, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

export function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  raw.split(";").forEach(function (part) {
    const i = part.indexOf("=");
    if (i > -1) {
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      try {
        out[k] = decodeURIComponent(v);
      } catch (e) {
        out[k] = v;
      }
    }
  });
  return out;
}

export function cookieStr(name, value, maxAgeSeconds) {
  return name + "=" + encodeURIComponent(value) +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAgeSeconds;
}

export function addCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", [cookie]);
  } else if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", prev.concat([cookie]));
  } else {
    res.setHeader("Set-Cookie", [prev, cookie]);
  }
}

export function setSession(res, session) {
  addCookie(res, cookieStr(SESSION_COOKIE, seal(session), 60 * 60 * 24 * 60));
}

export function clearSession(res) {
  addCookie(res, cookieStr(SESSION_COOKIE, "", 0));
}

export function redirectUri() {
  const r = process.env.PINTEREST_REDIRECT_URI;
  if (!r) throw new Error("PINTEREST_REDIRECT_URI env var missing");
  return r;
}

export function toSession(data, oldRefresh) {
  const expiresIn = Number(data.expires_in || 2592000);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || oldRefresh || null,
    expires_at: Date.now() + expiresIn * 1000,
    scope: data.scope || ""
  };
}

export async function tokenRequest(params) {
  const id = process.env.PINTEREST_APP_ID;
  const secret = process.env.PINTEREST_APP_SECRET;
  if (!id || !secret) throw new Error("PINTEREST_APP_ID or PINTEREST_APP_SECRET env var missing");
  const basic = Buffer.from(id + ":" + secret).toString("base64");
  const r = await fetch(OAUTH_BASE + "/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams(params).toString()
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok || !data.access_token) {
    console.error("Pinterest token error", r.status, JSON.stringify(data));
    return null;
  }
  return data;
}

// Returns the session (refreshing the access token if it is about to expire), or null.
export async function getSession(req, res) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  let s = unseal(raw);
  if (!s || !s.access_token) return null;
  if (s.expires_at && Date.now() > s.expires_at - 5 * 60 * 1000) {
    if (!s.refresh_token) return null;
    const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh_token });
    if (!fresh) return null;
    s = toSession(fresh, s.refresh_token);
    setSession(res, s);
  }
  return s;
}

export async function pinterest(session, path, options) {
  const opts = options || {};
  const r = await fetch(API_BASE + path, {
    method: opts.method || "GET",
    headers: {
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json"
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await r.json().catch(function () { return {}; });
  return { ok: r.ok, status: r.status, data: data };
}

export function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

export function isHttpUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (e) {
    return false;
  }
}

export function clip(s, max) {
  return String(s || "").trim().slice(0, max);
}
