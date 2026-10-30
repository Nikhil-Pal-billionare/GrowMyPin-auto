// Razorpay checkout for Studio plans.
// POST /api/pay/order   { plan_id }                                            -> order for Razorpay Checkout
// POST /api/pay/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature } -> plan turned on
// GET  /api/pay/status                                                         -> plan state (also finds late payments)

import { sendJson } from "../lib.js";
import { getUser, db, siteUrl } from "../app.js";
import { getProfile } from "../growth.js";
import { getSettings } from "../settings.js";
import {
  razorpayReady, razorpayKeyId, isTestMode, rzp, validSignature, findPlan,
  confirmPayment, reconcileUser, billingState
} from "../billing.js";

async function order(req, res, u) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  if (!razorpayReady()) return sendJson(res, 503, { error: "Online payment opens very soon. Message us on WhatsApp to start today.", code: "not_ready" });
  const settings = await getSettings();
  if (!settings.plans || !settings.plans.enabled) return sendJson(res, 400, { error: "Plans are not open right now." });
  const plan = findPlan(settings.plans, String((req.body || {}).plan_id || ""));
  if (!plan) return sendJson(res, 400, { error: "Pick a plan." });

  const p = await getProfile(u.id) || {};
  const amount = plan.price * 100; // paise
  const receipt = ("gmp_" + u.id.slice(0, 8) + "_" + Date.now().toString(36)).slice(0, 40);
  const rz = await rzp("/orders", {
    method: "POST",
    body: {
      amount: amount, currency: "INR", receipt: receipt,
      notes: { user_id: u.id, email: u.email, plan_id: plan.id, plan_name: plan.name, product: "GrowMyPin Studio" }
    }
  });
  await db("payments", {
    method: "POST",
    body: {
      user_id: u.id, email: u.email, name: p.name || u.name || null, phone: p.phone || u.whatsapp || null,
      plan_id: plan.id, plan_name: plan.name, months: plan.months,
      amount: amount, currency: "INR", razorpay_order_id: rz.id, status: "created", test_mode: isTestMode()
    },
    prefer: "return=minimal"
  });
  sendJson(res, 200, {
    key: razorpayKeyId(),
    order_id: rz.id,
    amount: amount,
    currency: "INR",
    plan: { id: plan.id, name: plan.name, months: plan.months, price: plan.price },
    name: "GrowMyPin",
    description: "GrowMyPin Studio - " + plan.name + " plan",
    image: siteUrl(req) + "/icon-192.png",
    prefill: { name: p.name || u.name || "", email: u.email || "", contact: p.phone || u.whatsapp || "" },
    test_mode: isTestMode()
  });
}

async function verify(req, res, u) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  if (!razorpayReady()) return sendJson(res, 503, { error: "Payments are not set up yet." });
  const b = req.body || {};
  const orderId = String(b.razorpay_order_id || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
  const paymentId = String(b.razorpay_payment_id || "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 60);
  if (!orderId || !paymentId) return sendJson(res, 400, { error: "Payment details missing." });
  if (!validSignature(orderId, paymentId, b.razorpay_signature)) {
    return sendJson(res, 400, { error: "We could not verify this payment. If money was taken, it will show here in a few minutes or be refunded by Razorpay." });
  }
  const rows = await db("payments?select=*&razorpay_order_id=eq." + orderId + "&user_id=eq." + u.id + "&limit=1");
  const row = rows && rows[0];
  if (!row) return sendJson(res, 404, { error: "Order not found for this account." });
  if (row.status !== "paid") {
    const r = await confirmPayment(row, paymentId);
    if (!r.paid) return sendJson(res, 202, { ok: false, pending: true, error: "Payment is still processing. This page will update by itself." });
  }
  const p = await getProfile(u.id);
  sendJson(res, 200, { ok: true, billing: billingState(p), payment_id: paymentId });
}

async function status(req, res, u) {
  await reconcileUser(u.id);
  const p = await getProfile(u.id);
  sendJson(res, 200, { billing: billingState(p) });
}

export default async function handler(req, res, sub) {
  try {
    const u = getUser(req);
    if (!u) return sendJson(res, 401, { error: "Please log in again." });
    if (sub === "order") return await order(req, res, u);
    if (sub === "verify") return await verify(req, res, u);
    if (sub === "status") return await status(req, res, u);
    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    console.error("pay", sub, e.message, JSON.stringify(e.detail || {}).slice(0, 400));
    const dbMissing = /payments|plan_until|plan_id/i.test(JSON.stringify(e.detail || {}));
    sendJson(res, 500, { error: dbMissing ? "Payments table missing. (Admin: run the v1.4 part of supabase.sql.)" : (e.status ? e.message : "Payment could not start. Please try again.") });
  }
}
