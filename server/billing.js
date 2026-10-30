// Razorpay payments + Studio plans. Not a route (lives outside /api).
//
// Env vars (Vercel): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// Use the rzp_test_ keys first to test, then swap to rzp_live_ keys and Redeploy.
//
// Flow:
//   1. /api/pay/order   creates a Razorpay order for one plan (amount always comes from Admin > Plans, never the browser)
//   2. Razorpay Checkout opens in the browser (UPI, cards, netbanking, wallets)
//   3. /api/pay/verify  checks the Razorpay signature + asks Razorpay for the payment, then turns the plan on
//   4. If the person closed the window after paying, reconcileUser() finds the payment later (home page load)

import crypto from "crypto";
import { db } from "./app.js";
import { findPlan } from "./settings.js";

const RZP = "https://api.razorpay.com/v1";

export function razorpayReady() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function razorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || "";
}

export function isTestMode() {
  return /^rzp_test_/.test(razorpayKeyId());
}

export async function rzp(path, opts) {
  const o = opts || {};
  const basic = Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64");
  const r = await fetch(RZP + path, {
    method: o.method || "GET",
    headers: { "Authorization": "Basic " + basic, "Content-Type": "application/json" },
    body: o.body ? JSON.stringify(o.body) : undefined,
    signal: AbortSignal.timeout(12000)
  });
  const data = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const msg = (data && data.error && data.error.description) || ("Razorpay error " + r.status);
    const err = new Error(msg);
    err.status = r.status;
    err.detail = data;
    throw err;
  }
  return data;
}

// Razorpay signature for Checkout = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function validSignature(orderId, paymentId, signature) {
  const want = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(String(orderId) + "|" + String(paymentId)).digest("hex");
  const got = String(signature || "");
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 Jan + 1 month = 28/29 Feb, not 3 Mar
  return d;
}

// What the home page needs to know about the person's plan.
export function billingState(profile) {
  const p = profile || {};
  const until = p.plan_until ? new Date(p.plan_until) : null;
  const active = !!(until && until.getTime() > Date.now());
  return {
    active: active,
    plan_id: p.plan_id || "",
    plan_name: p.plan_name || "",
    plan_until: until ? until.toISOString() : null,
    days_left: active ? Math.ceil((until.getTime() - Date.now()) / 86400000) : 0
  };
}

// Plans as the browser sees them (only after Pinterest connect, or for an admin preview).
export function publicPlans(settings) {
  const pl = settings.plans || {};
  if (!pl.enabled) return null;
  const monthly = (pl.items || []).find(function (x) { return x.id === "m1"; });
  const base = monthly ? monthly.price : 0;
  const items = (pl.items || []).filter(function (x) { return x.on; }).map(function (x) {
    const perMonth = Math.round(x.price / x.months);
    const vsMonthly = base && x.months > 1 ? base * x.months - x.price : 0;
    return {
      id: x.id, name: x.name, months: x.months, price: x.price, compare: x.compare,
      per_month: perMonth, save: vsMonthly > 0 ? vsMonthly : 0,
      off_pct: x.compare > x.price ? Math.round(100 * (x.compare - x.price) / x.compare) : 0,
      tag: x.tag, levels: x.levels
    };
  });
  if (!items.length) return null;
  const now = Date.now();
  const end = new Date(settings.offer_end).getTime();
  const start = new Date(settings.offer_start).getTime();
  const offerLive = !!settings.offer_enabled && (!(start > 0) || now >= start) && end > now;
  return {
    items: items,
    featured: items.some(function (x) { return x.id === pl.featured; }) ? pl.featured : items[0].id,
    levels: pl.levels || [],
    headline: pl.headline,
    note: pl.note,
    offer_name: offerLive ? settings.offer_name : "",
    offer_end: offerLive ? new Date(end).toISOString() : null,
    pay_ready: razorpayReady(),
    test_mode: isTestMode(),
    whatsapp: settings.sales_whatsapp || ""
  };
}

// Marks one payment row as paid and extends the person's plan. Safe to call many times:
// only the call that actually flips the row from "created" to "paid" extends the plan.
export async function activatePayment(row, payment) {
  const flipped = await db("payments?id=eq." + row.id + "&status=neq.paid", {
    method: "PATCH",
    body: {
      status: "paid",
      razorpay_payment_id: payment.id,
      method: String(payment.method || "").slice(0, 30) || null,
      paid_at: new Date().toISOString()
    }
  });
  if (!Array.isArray(flipped) || !flipped.length) return { already: true };

  const prof = await db("profiles?select=id,plan_until&id=eq." + row.user_id + "&limit=1");
  const cur = prof && prof[0] && prof[0].plan_until ? new Date(prof[0].plan_until) : null;
  const from = cur && cur.getTime() > Date.now() ? cur : new Date();
  const until = addMonths(from, Number(row.months) || 1);
  await db("profiles?id=eq." + row.user_id, {
    method: "PATCH",
    body: { plan_id: row.plan_id, plan_name: row.plan_name, plan_until: until.toISOString(), plan_started_at: new Date().toISOString() },
    prefer: "return=minimal"
  });
  await db("payments?id=eq." + row.id, {
    method: "PATCH",
    body: { period_start: from.toISOString(), period_end: until.toISOString() },
    prefer: "return=minimal"
  });
  return { already: false, until: until.toISOString() };
}

// Checks one payment with Razorpay and activates it when it is really paid for this order and amount.
export async function confirmPayment(row, paymentId) {
  let pay = await rzp("/payments/" + encodeURIComponent(paymentId));
  if (pay.order_id !== row.razorpay_order_id) throw new Error("This payment does not belong to this order.");
  if (Number(pay.amount) !== Number(row.amount)) throw new Error("Payment amount does not match the plan.");
  if (pay.status === "authorized") {
    // account not on auto-capture: capture it now so the money really comes to GrowMyPin
    pay = await rzp("/payments/" + encodeURIComponent(paymentId) + "/capture", { method: "POST", body: { amount: Number(row.amount), currency: row.currency || "INR" } });
  }
  if (pay.status !== "captured") return { paid: false, status: pay.status };
  const r = await activatePayment(row, pay);
  return { paid: true, until: r.until || null };
}

// Person paid but closed the window before we heard back: look at their recent open orders.
export async function reconcileUser(userId) {
  if (!razorpayReady()) return 0;
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  let rows = [];
  try {
    rows = await db("payments?select=*&user_id=eq." + userId + "&status=eq.created&created_at=gte." + since + "&order=created_at.desc&limit=3");
  } catch (e) { return 0; }
  let done = 0;
  for (const row of rows || []) {
    try {
      const list = await rzp("/orders/" + encodeURIComponent(row.razorpay_order_id) + "/payments");
      const items = (list && list.items) || [];
      const good = items.find(function (p) { return p.status === "captured" || p.status === "authorized"; });
      if (good) {
        const r = await confirmPayment(row, good.id);
        if (r.paid) done++;
      }
    } catch (e) { console.error("reconcile", e.message); }
  }
  return done;
}

export { findPlan };
