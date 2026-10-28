// ONE serverless function for every /api route (Vercel Hobby allows max 12 functions).
// vercel.json rewrites /api/<route> -> /api/router?__r=<route> and /admin -> admin page.
// The real code for each route lives in /server/routes (not deployed as separate functions).

import authLogin from "../server/routes/auth/login.js";
import authCallback from "../server/routes/auth/callback.js";
import authLogout from "../server/routes/auth/logout.js";
import me from "../server/routes/me.js";
import generate from "../server/routes/generate.js";
import publish from "../server/routes/publish.js";
import analytics from "../server/routes/analytics.js";
import pinStats from "../server/routes/pin-stats.js";
import userSignup from "../server/routes/user/signup.js";
import userLogin from "../server/routes/user/login.js";
import userLogout from "../server/routes/user/logout.js";
import userMe from "../server/routes/user/me.js";
import userForgot from "../server/routes/user/forgot.js";
import userReset from "../server/routes/user/reset.js";
import userHub from "../server/routes/user/hub.js";
import userHome from "../server/routes/user/home.js";
import reportCreate from "../server/routes/report/create.js";
import reportGet from "../server/routes/report/get.js";
import reportCron from "../server/routes/report/cron.js";
import track from "../server/routes/track.js";
import admin from "../server/routes/admin.js";

const ROUTES = {
  "auth/login": authLogin,
  "auth/callback": authCallback,
  "auth/logout": authLogout,
  "me": me,
  "generate": generate,
  "publish": publish,
  "analytics": analytics,
  "pin-stats": pinStats,
  "user/signup": userSignup,
  "user/login": userLogin,
  "user/logout": userLogout,
  "user/me": userMe,
  "user/forgot": userForgot,
  "user/reset": userReset,
  "user/hub": userHub,
  "user/home": userHome,
  "report/create": reportCreate,
  "report/get": reportGet,
  "report/cron": reportCron,
  "track": track,
  "admin/page": function (req, res) { return admin(req, res, "page"); },
  "admin/data": function (req, res) { return admin(req, res, "data"); },
  "admin/message": function (req, res) { return admin(req, res, "message"); },
  "admin/settings": function (req, res) { return admin(req, res, "settings"); },
  "admin/admins": function (req, res) { return admin(req, res, "admins"); }
};

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  let route = url.searchParams.get("__r");
  if (route === null) route = url.pathname.replace(/^\/api\/?/, "");
  route = String(route).replace(/^\/+|\/+$/g, "").replace(/\.js$/, "");
  const fn = Object.prototype.hasOwnProperty.call(ROUTES, route) ? ROUTES[route] : null;
  if (!fn) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "Not found" }));
  }
  return fn(req, res);
}

