// GrowMyPin growth model + forecast widget. Shared by home.html, signup.html, the visits popup (gmp.js)
// and the admin preview, so every page shows the same numbers for the same shop.
//
// The numbers come from Admin > Growth graph (settings.growth):
//   niches[].views[rank][month]  = Pinterest views in that month (monthly total) for a new account
//   niches[].visits[rank][month] = store visits from Pinterest in that month (Etsy)
//   rank[niche or _all]          = which strategy is Best, 2nd best, Middle, 2nd worst, Worst
//   pins_pct, stores, vary       = bonus for pins already on Pinterest, store %, small personal variation
// Nothing here counts per day. Everything is monthly totals and 3 / 6 month totals.
(function () {
  if (window.GMPGrowth) return;
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var NAMES = { etsy: "Etsy", shopify: "Shopify", ebay: "eBay" };
  var ORDER = ["etsy", "shopify", "ebay"];
  var RANK_LABELS = ["Best", "2nd best", "Middle", "2nd worst", "Worst"];
  var COLORS = ["#34D6A8", "#5BC0EB", "#A78BFA", "#FFB65C", "#FF7A93"];
  var PIN_TIERS = [
    { label: "No pins yet", short: "0 pins", value: 0, min: 0 },
    { label: "1 to 24 pins", short: "1-24 pins", value: 12, min: 1 },
    { label: "25 to 99 pins", short: "25-99 pins", value: 60, min: 25 },
    { label: "100 to 299 pins", short: "100-299 pins", value: 200, min: 100 },
    { label: "300 or more pins", short: "300+ pins", value: 400, min: 300 }
  ];
  var PHASES = ["Pinterest learns your shop", "Your first pins start ranking", "Views take off", "Buyers find you every day", "Your pins keep compounding", "Your shop becomes a Pinterest brand"];
  var MILESTONES = [1000000, 500000, 200000, 100000, 50000, 25000, 10000];

  // Used only until the real settings arrive from the server.
  var FALLBACK = {
    strategies: {
      trend: { name: "Trend wave", short: "Pins on what buyers search this month" },
      gift: { name: "Gift angle", short: "Gift for mom, for her, for him pins with buying intent" },
      evergreen: { name: "Evergreen SEO", short: "Keyword pins that keep ranking for months" },
      hook: { name: "Curiosity hooks", short: "Big text hooks that stop the scroll" },
      lifestyle: { name: "Lifestyle glow", short: "Warm, glowing lifestyle scenes around the product" }
    },
    rank: { _all: ["gift", "trend", "hook", "lifestyle", "evergreen"] },
    tier_pct: [100, 80, 63, 47, 33],
    niches: [{ name: "Other", views: null, visits: null, best: [3000, 13000, 35000, 64000, 96000, 130000], bestV: [30, 140, 400, 780, 1200, 1650] }],
    pins_pct: [100, 105, 112, 122, 135],
    stores: { etsy: { visits: 100, cvr: 2.5 }, shopify: { visits: 85, cvr: 1.6 }, ebay: { visits: 75, cvr: 2 } },
    vary: 5
  };
  (function () {
    var n = FALLBACK.niches[0];
    n.views = FALLBACK.tier_pct.map(function (p) { return n.best.map(function (v) { return Math.round(v * p / 100); }); });
    n.visits = FALLBACK.tier_pct.map(function (p) { return n.bestV.map(function (v) { return Math.round(v * p / 100); }); });
  })();
  var CFG = FALLBACK;

  function setConfig(g) {
    if (g && g.niches && g.niches.length && g.rank && g.rank._all) CFG = g;
    return CFG;
  }

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function sum(a, n) { var s = 0; for (var i = 1; i <= n && i < a.length; i++) s += a[i]; return s; }

  function niches() { return CFG.niches.map(function (n) { return n.name; }); }
  function findNiche(name) {
    var w = String(name || "").toLowerCase();
    for (var i = 0; i < CFG.niches.length; i++) if (CFG.niches[i].name.toLowerCase() === w) return CFG.niches[i];
    return null;
  }
  function pinsTier(count) {
    if (count === null || count === undefined || count === "" || isNaN(Number(count))) return -1;
    var c = Number(count), t = 0;
    for (var i = 0; i < PIN_TIERS.length; i++) if (c >= PIN_TIERS[i].min) t = i;
    return t;
  }
  function pickPlatform(list) {
    list = list || [];
    for (var i = 0; i < ORDER.length; i++) if (list.indexOf(ORDER[i]) > -1) return ORDER[i];
    return "";
  }

  // input: { niche, platform, pins, hasPin, current (monthly views now), seed, target }
  function plan(input) {
    var o = input || {};
    var g = CFG;
    var N = findNiche(o.niche);
    var known = !!N;
    if (!N) N = findNiche("Other") || g.niches[g.niches.length - 1];
    var order = (g.rank && g.rank[N.name]) || g.rank._all;
    var pt = pinsTier(o.pins);
    var pinsKnown = pt > -1;
    if (pt < 0) pt = o.hasPin ? 1 : 0;
    var pm = (g.pins_pct[pt] || 100) / 100;
    var platform = NAMES[o.platform] ? o.platform : "etsy";
    var st = (g.stores && g.stores[platform]) || { visits: 100, cvr: 2.5 };
    var r = rng(hash(String(o.seed || "shop") + "|" + N.name));
    var jit = 1 + (r() * 2 - 1) * (Number(g.vary) || 0) / 100;
    var cur = Math.max(0, Math.round(Number(o.current) || 0));
    var ratio = N.visits[0][5] / Math.max(1, N.views[0][5]);
    if (!(ratio > 0)) ratio = 0.01;
    var visitK = (st.visits || 0) / 100, cvr = (st.cvr || 0) / 100;
    var list = order.map(function (id, t) {
      var meta = (g.strategies && g.strategies[id]) || { name: id, short: "" };
      var views = [cur], visits = [Math.round(cur * ratio * visitK)];
      for (var i = 0; i < 6; i++) {
        views.push(Math.round(cur + N.views[t][i] * pm * jit));
        visits.push(Math.round((cur * ratio + N.visits[t][i] * pm * jit) * visitK));
      }
      var sales = visits.map(function (v) { return v * cvr; });
      return { id: id, rank: t, label: RANK_LABELS[t], color: COLORS[t], name: meta.name, short: meta.short, views: views, visits: visits, sales: sales };
    });
    var target = Number(o.target) || 0;
    var goalVisits = target && cvr ? Math.ceil(target / cvr) : 0;
    return {
      niche: N.name, nicheKnown: known, platform: platform, store: NAMES[platform],
      pinsTier: pt, pinsKnown: pinsKnown, pinsLive: !!o.pinsLive, pins: o.pins, current: cur,
      cvr: cvr, target: target, goalVisits: goalVisits,
      goalViews: goalVisits ? Math.round(goalVisits / Math.max(0.0001, ratio * visitK)) : 0,
      list: list, best: list[0], worst: list[list.length - 1]
    };
  }

  function fmt(n) {
    n = Math.round(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "K";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }
  // full number with commas below 100K (for store visits, sales)
  function fmtFull(n) {
    n = Math.round(n || 0);
    if (n >= 100000) return fmt(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function countUp(el, to, ms, f) {
    f = f || fmt;
    if (!el) return;
    if (reduce || !to) { el.textContent = f(to); return; }
    var start = null, token = {};
    el._cu = token;
    requestAnimationFrame(function step(t) {
      if (el._cu !== token) return;
      if (start === null) start = t;
      var k = Math.min(1, (t - start) / (ms || 1200));
      el.textContent = f(to * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    });
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

  // ---------- svg helpers ----------
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function smooth(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      c1y = Math.min(c1y, Math.max(p1[1], p2[1])); c2y = Math.min(c2y, Math.max(p1[1], p2[1]));
      d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }
  function reveal(clipRect, W, ms) {
    if (reduce || !ms) { clipRect.setAttribute("width", W); return; }
    var start = null;
    requestAnimationFrame(function anim(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / ms);
      clipRect.setAttribute("width", (W * (1 - Math.pow(1 - k, 3))).toFixed(1));
      if (k < 1) requestAnimationFrame(anim);
    });
  }

  // ---------- styles ----------
  var css = document.createElement("style");
  css.textContent =
    ".gw{--gw-mut:#A9C2BC;--gw-line:rgba(255,255,255,.1);--gw-card:rgba(255,255,255,.05);position:relative;isolation:isolate;overflow:hidden;border-radius:28px;color:#fff;padding:clamp(18px,3.4vw,30px);display:grid;gap:18px;font-family:Figtree,system-ui,sans-serif;" +
    "background:radial-gradient(70% 55% at 100% 0%,rgba(20,184,143,.28) 0,transparent 70%),radial-gradient(60% 50% at 0% 100%,rgba(242,154,46,.22) 0,transparent 70%),linear-gradient(160deg,#08221E 0%,#061815 55%,#0A1412 100%);box-shadow:0 40px 80px -40px rgba(6,24,21,.8)}" +
    ".gw *{box-sizing:border-box}" +
    ".gw-orb{position:absolute;z-index:-1;border-radius:50%;filter:blur(40px);opacity:.5;pointer-events:none}" +
    ".gw-orb.a{width:240px;height:240px;right:-90px;top:-80px;background:#14B88F;animation:gwFloat 9s ease-in-out infinite alternate}" +
    ".gw-orb.b{width:180px;height:180px;left:20%;bottom:-80px;background:#F29A2E;opacity:.28;animation:gwFloat 11s ease-in-out infinite alternate-reverse}" +
    ".gw-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}" +
    ".gw-kick{display:inline-flex;align-items:center;gap:8px;font-size:.8rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#34D6A8}" +
    ".gw-kick i{width:8px;height:8px;border-radius:50%;background:#34D6A8;box-shadow:0 0 0 0 rgba(52,214,168,.6);animation:gwPing 1.8s infinite}" +
    ".gw-chips{display:flex;gap:8px;flex-wrap:wrap}" +
    ".gw-chip{position:relative;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--gw-line);background:var(--gw-card);border-radius:999px;padding:7px 12px;font-size:.84rem;font-weight:700;color:#E8F3F0;white-space:nowrap}" +
    ".gw-chip svg{width:14px;height:14px;flex:none}" +
    ".gw-chip select{appearance:none;-webkit-appearance:none;background:transparent;border:0;color:inherit;font:inherit;font-weight:700;padding:0 16px 0 0;cursor:pointer;max-width:170px}" +
    ".gw-chip select option{color:#1F242B}" +
    ".gw-chip.sel::after{content:'';position:absolute;right:12px;top:50%;width:6px;height:6px;border-right:2px solid #A9C2BC;border-bottom:2px solid #A9C2BC;transform:translateY(-70%) rotate(45deg);pointer-events:none}" +
    ".gw-chip.ask{border-color:#FFC75A;background:rgba(255,199,90,.12);color:#FFE7A8;animation:gwGlow 1.8s ease-in-out infinite}" +
    ".gw-chip.live{border-color:rgba(52,214,168,.5);color:#BFF5E3}" +
    ".gw-lead{margin:0;font-size:clamp(1rem,2.2vw,1.18rem);color:#DDEBE7;line-height:1.45}" +
    ".gw-lead b{color:#fff}" +
    ".gw-tag{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:2px 10px;font-size:.78rem;font-weight:800;vertical-align:.12em;color:#06231C;background:#34D6A8}" +
    ".gw-big{display:flex;align-items:flex-end;gap:clamp(14px,3vw,30px);flex-wrap:wrap;margin-top:6px}" +
    ".gw-big>div{display:grid;gap:2px}" +
    ".gw-big b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;letter-spacing:-.045em;line-height:.95;font-size:clamp(2.6rem,8.4vw,4.4rem);background:linear-gradient(180deg,#FFF6D2 5%,#FFC75A 55%,#F29A2E);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gw-big .v2 b{background:linear-gradient(180deg,#E7FFF7 5%,#34D6A8 60%,#14B88F);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gw-big small{font-size:.9rem;color:var(--gw-mut);font-weight:700}" +
    ".gw-big .plus{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:2rem;color:rgba(255,255,255,.35);padding-bottom:22px}" +
    ".gw-sub{margin:4px 0 0;color:var(--gw-mut);font-size:.95rem}" +
    ".gw-vs{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:8px 12px;border-radius:14px;background:rgba(255,199,90,.1);border:1px solid rgba(255,199,90,.25);color:#FFE7A8;font-weight:700;font-size:.9rem}" +
    ".gw-vs svg{width:16px;height:16px;flex:none}" +
    ".gw-ctrl{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}" +
    ".gw-seg{display:inline-grid;grid-template-columns:1fr 1fr;background:rgba(255,255,255,.07);border:1px solid var(--gw-line);border-radius:999px;padding:4px;position:relative}" +
    ".gw-seg button{position:relative;z-index:1;border:0;background:none;font:inherit;font-weight:800;font-size:.86rem;padding:8px 15px;border-radius:999px;cursor:pointer;color:var(--gw-mut);transition:color .25s;white-space:nowrap}" +
    ".gw-seg button.on{color:#06231C}" +
    ".gw-seg .knob{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:999px;background:linear-gradient(135deg,#BFF5E3,#34D6A8);transition:transform .4s cubic-bezier(.2,.8,.2,1)}" +
    ".gw-seg.r2 .knob{transform:translateX(100%)}" +
    ".gw-cap{font-size:.82rem;color:var(--gw-mut)}" +
    ".gw-chart{position:relative;border-radius:20px;background:rgba(0,0,0,.18);border:1px solid var(--gw-line);padding:10px 6px 4px}" +
    ".gw-chart svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}" +
    ".gw-ax{font-family:Figtree,system-ui,sans-serif;font-size:11px;fill:#7F9893}" +
    ".gw-vl{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11.5px;fill:#fff;transition:opacity .3s}" +
    ".gw-goal{stroke:#FFC75A;stroke-width:1.6;stroke-dasharray:6 6;fill:none}" +
    ".gw-goal-t{font-family:Figtree,system-ui,sans-serif;font-size:11px;font-weight:800;fill:#FFC75A}" +
    ".gw-tip rect{fill:#0B1F1C;stroke:rgba(255,255,255,.18)}.gw-tip text{font-family:Figtree,system-ui,sans-serif;font-size:11.5px;fill:#DDEBE7}.gw-tip .h{font-weight:800;fill:#fff}" +
    ".gw-board{display:grid;gap:8px}" +
    ".gw-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;text-align:left;border:1px solid var(--gw-line);background:var(--gw-card);border-radius:16px;padding:10px 12px;font:inherit;color:#fff;cursor:pointer;transition:background .25s,border-color .25s,transform .25s}" +
    ".gw-row:hover{background:rgba(255,255,255,.08)}" +
    ".gw-row.on{border-color:var(--c);background:linear-gradient(90deg,rgba(255,255,255,.1),rgba(255,255,255,.03));transform:translateX(3px)}" +
    ".gw-badge{display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:999px;padding:5px 8px;font-size:.74rem;font-weight:800;color:#06231C;background:var(--c);white-space:nowrap}" +
    ".gw-badge svg{width:13px;height:13px}" +
    ".gw-nm{min-width:0;display:grid;gap:5px}" +
    ".gw-nm b{font-family:Montserrat,system-ui,sans-serif;font-size:.98rem;letter-spacing:-.01em}" +
    ".gw-nm b em{font-style:normal;font-family:Figtree,system-ui,sans-serif;font-weight:600;font-size:.82rem;color:var(--gw-mut);margin-left:6px}" +
    ".gw-bar{height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}" +
    ".gw-bar i{display:block;height:100%;width:0;border-radius:6px;background:var(--c);box-shadow:0 0 14px var(--c);transition:width 1.1s cubic-bezier(.2,.8,.2,1)}" +
    ".gw-val{text-align:right;display:grid;gap:1px}" +
    ".gw-val b{font-family:Montserrat,system-ui,sans-serif;font-size:1.08rem;letter-spacing:-.02em}" +
    ".gw-val small{font-size:.74rem;color:var(--gw-mut);white-space:nowrap}" +
    ".gw-runs{display:inline-block;margin-left:6px;font-size:.7rem;font-weight:800;color:#FFC75A;font-family:Figtree,system-ui,sans-serif;letter-spacing:0}" +
    ".gw-h3{margin:0;font-family:Montserrat,system-ui,sans-serif;font-size:1.02rem;letter-spacing:-.01em;color:#fff}" +
    ".gw-months{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}" +
    ".gw-m{position:relative;border-radius:16px;padding:12px;background:var(--gw-card);border:1px solid var(--gw-line);display:grid;gap:3px;opacity:0;transform:translateY(10px);animation:gwRise .5s cubic-bezier(.2,.8,.2,1) forwards}" +
    ".gw-m .t{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--gw-mut)}" +
    ".gw-m b{font-family:Montserrat,system-ui,sans-serif;font-size:1.3rem;letter-spacing:-.03em}" +
    ".gw-m small{font-size:.76rem;color:#CFE2DD}" +
    ".gw-m .p{font-size:.74rem;color:var(--gw-mut);line-height:1.3}" +
    ".gw-m .ms{position:absolute;top:-9px;right:8px;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:800;color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 45%,#F29A2E);box-shadow:0 6px 16px -6px rgba(242,154,46,.8)}" +
    ".gw-m.up{background:linear-gradient(180deg,rgba(52,214,168,.12),rgba(255,255,255,.04));border-color:rgba(52,214,168,.35)}" +
    ".gw-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}" +
    ".gw-stats div{border-radius:16px;padding:12px 14px;background:var(--gw-card);border:1px solid var(--gw-line);display:grid;gap:2px}" +
    ".gw-stats b{font-family:Montserrat,system-ui,sans-serif;font-size:clamp(1.1rem,2.6vw,1.4rem);letter-spacing:-.02em}" +
    ".gw-stats small{font-size:.78rem;color:var(--gw-mut);line-height:1.3}" +
    ".gw-stats .gold{background:rgba(255,199,90,.1);border-color:rgba(255,199,90,.3)}" +
    ".gw-stats .gold b{color:#FFC75A}" +
    ".gw-fine{margin:0;font-size:.76rem;color:#7F9893;line-height:1.45}" +
    "@keyframes gwPing{0%{box-shadow:0 0 0 0 rgba(52,214,168,.6)}80%,100%{box-shadow:0 0 0 10px rgba(52,214,168,0)}}" +
    "@keyframes gwGlow{0%,100%{box-shadow:0 0 0 0 rgba(255,199,90,.0)}50%{box-shadow:0 0 0 5px rgba(255,199,90,.18)}}" +
    "@keyframes gwFloat{from{transform:translate(0,0)}to{transform:translate(-30px,20px)}}" +
    "@keyframes gwRise{to{opacity:1;transform:none}}" +
    "@media (max-width:640px){.gw-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.gw-row{grid-template-columns:minmax(0,1fr) auto;row-gap:8px}.gw-row .gw-badge{grid-column:1/-1;justify-self:start}.gw-big .plus{display:none}.gw-nm b em{display:none}.gw-months{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    "@media (prefers-reduced-motion:reduce){.gw-orb,.gw-kick i,.gw-chip.ask{animation:none}.gw-m{opacity:1;transform:none;animation:none}}" +
    // old small chart in the visits popup
    ".gg-band{fill:rgba(15,150,130,.12)}";
  document.head.appendChild(css);

  var CROWN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z"/></svg>';
  var BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>';

  // ---------- multi strategy chart ----------
  // opts: { range: 3|6, metric: "views"|"visits", sel: rank index, goal: monthly goal value, ms: animation ms }
  function drawRace(svg, P, opts) {
    var o = opts || {};
    var n = o.range || 3, key = o.metric === "visits" ? "visits" : "views", sel = o.sel || 0;
    svg.innerHTML = "";
    var cw = svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 680;
    var narrow = cw < 520;
    var W = narrow ? Math.max(300, Math.round(cw)) : 700, H = narrow ? 270 : 320;
    var L = narrow ? 40 : 48, R = narrow ? 14 : 78, T = 26, B = 34;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var series = P.list.map(function (s) { return s[key].slice(0, n + 1); });
    var maxData = 1;
    series.forEach(function (a) { a.forEach(function (v) { if (v > maxData) maxData = v; }); });
    var goal = o.goal || 0;
    var goalOn = goal > 0 && goal <= maxData * 1.35;
    var raw = Math.max(maxData, goalOn ? goal : 0) * 1.1 / 4;
    var p10 = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    var f = raw / p10;
    var top = 4 * p10 * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10);
    var x = function (i) { return L + (W - L - R) * i / n; };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var gid = "gw" + Math.random().toString(36).slice(2, 8);
    var col = P.list[sel].color;

    var defs = el("defs", {}, svg);
    var lg = el("linearGradient", { id: gid + "a", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": col, "stop-opacity": ".42" }, lg);
    el("stop", { offset: "1", "stop-color": col, "stop-opacity": "0" }, lg);
    var fl = el("filter", { id: gid + "g", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    el("feGaussianBlur", { stdDeviation: "4", result: "b" }, fl);
    var fm = el("feMerge", {}, fl);
    el("feMergeNode", { "in": "b" }, fm);
    el("feMergeNode", { "in": "SourceGraphic" }, fm);
    var cp = el("clipPath", { id: gid + "c" }, defs);
    var clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cp);

    var grid = el("g", {}, svg);
    for (var g = 0; g <= 4; g++) {
      var gv = top * g / 4;
      el("line", { x1: L, x2: W - R, y1: y(gv), y2: y(gv), stroke: "rgba(255,255,255,.07)" }, grid);
      el("text", { "class": "gw-ax", x: L - 8, y: y(gv) + 4, "text-anchor": "end" }, grid).textContent = fmt(gv);
    }
    for (var m = 0; m <= n; m++) {
      el("text", { "class": "gw-ax", x: x(m), y: H - 10, "text-anchor": "middle", "font-weight": m === n ? 800 : 500 }, grid).textContent = m === 0 ? "Now" : (narrow ? "M" + m : "Month " + m);
    }
    if (goalOn) {
      el("line", { "class": "gw-goal", x1: L, x2: W - R, y1: y(goal), y2: y(goal) }, svg);
      el("text", { "class": "gw-goal-t", x: L + 6, y: y(goal) - 7 }, svg).textContent = "Your goal: " + fmt(goal) + (key === "visits" ? " visits" : " views") + " a month";
    }

    var plot = el("g", { "clip-path": "url(#" + gid + "c)" }, svg);
    var selPts = series[sel].map(function (v, i) { return [x(i), y(v)]; });
    var sd = smooth(selPts);
    el("path", { d: sd + " L" + x(n) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z", fill: "url(#" + gid + "a)" }, plot);
    for (var t = P.list.length - 1; t >= 0; t--) {
      var pts = series[t].map(function (v, i) { return [x(i), y(v)]; });
      var d = smooth(pts);
      if (t === sel) continue;
      el("path", { d: d, fill: "none", stroke: P.list[t].color, "stroke-width": 2, "stroke-opacity": .5, "stroke-linecap": "round" }, plot);
      el("circle", { cx: pts[n][0], cy: pts[n][1], r: 3.5, fill: P.list[t].color, opacity: .7 }, plot);
    }
    el("path", { d: sd, fill: "none", stroke: col, "stroke-width": 4.5, "stroke-linecap": "round", "stroke-linejoin": "round", filter: "url(#" + gid + "g)" }, plot);

    var dots = el("g", {}, svg);
    var ms = o.ms === undefined ? 1500 : o.ms;
    selPts.forEach(function (p, i) {
      if (i === 0 && !series[sel][0]) return;
      var c = el("circle", { cx: p[0], cy: p[1], r: reduce || !ms ? 5 : 0, fill: "#061815", stroke: col, "stroke-width": 3, style: "transition:r .3s" }, dots);
      var showLbl = !narrow || i === n || n <= 3;
      var lb = null;
      if (showLbl && i > 0) {
        lb = el("text", { "class": "gw-vl", x: p[0], y: p[1] - 12, "text-anchor": i === n && !narrow ? "middle" : "middle", opacity: reduce || !ms ? 1 : 0 }, dots);
        lb.textContent = fmt(series[sel][i]);
      }
      if (!reduce && ms) setTimeout(function () { c.setAttribute("r", i === n ? 7 : 5); if (lb) lb.setAttribute("opacity", 1); }, 200 + ms * i / n);
    });
    if (!narrow) {
      var endY = selPts[n][1];
      var pill = el("g", { transform: "translate(" + (W - R + 10) + " " + (endY - 12) + ")", opacity: reduce || !ms ? 1 : 0, style: "transition:opacity .4s" }, svg);
      el("rect", { width: 66, height: 24, rx: 12, fill: col }, pill);
      var pt = el("text", { x: 33, y: 16, "text-anchor": "middle", "font-family": "Montserrat,system-ui,sans-serif", "font-weight": 800, "font-size": 12, fill: "#06231C" }, pill);
      pt.textContent = fmt(series[sel][n]);
      if (!reduce && ms) setTimeout(function () { pill.setAttribute("opacity", 1); }, ms + 150);
    }
    reveal(clipRect, W, ms);

    // tooltip: hover or tap a month
    var guide = el("line", { x1: 0, x2: 0, y1: T - 6, y2: H - B, stroke: "rgba(255,255,255,.35)", "stroke-dasharray": "3 4", opacity: 0 }, svg);
    var tip = el("g", { "class": "gw-tip", opacity: 0, "pointer-events": "none" }, svg);
    var tw = 176, th = 26 + P.list.length * 17;
    el("rect", { width: tw, height: th, rx: 12 }, tip);
    var tHead = el("text", { "class": "h", x: 12, y: 18 }, tip);
    var rows = P.list.map(function (s, k) {
      el("circle", { cx: 16, cy: 34 + k * 17, r: 4, fill: s.color }, tip);
      var a = el("text", { x: 26, y: 38 + k * 17 }, tip);
      var b = el("text", { x: tw - 12, y: 38 + k * 17, "text-anchor": "end", "font-weight": 800 }, tip);
      return [a, b];
    });
    function showAt(i) {
      i = Math.max(0, Math.min(n, i));
      guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("opacity", 1);
      tHead.textContent = (i === 0 ? "Now" : "Month " + i) + " - " + (key === "visits" ? "store visits" : "views");
      P.list.forEach(function (s, k) {
        rows[k][0].textContent = s.label + ": " + s.name;
        rows[k][1].textContent = key === "visits" ? fmtFull(s[key][i]) : fmt(s[key][i]);
      });
      var tx = x(i) + 14;
      if (tx + tw > W - 4) tx = x(i) - tw - 14;
      if (tx < 4) tx = 4;
      tip.setAttribute("transform", "translate(" + tx.toFixed(1) + " " + T + ")");
      tip.setAttribute("opacity", 1);
    }
    function hide() { tip.setAttribute("opacity", 0); guide.setAttribute("opacity", 0); }
    var hit = el("rect", { x: L - 10, y: 0, width: W - L - R + 20, height: H - B + 6, fill: "transparent", style: "cursor:crosshair" }, svg);
    function idx(ev) {
      var b = svg.getBoundingClientRect();
      var sx = (ev.clientX - b.left) / b.width * W;
      return Math.round((sx - L) / (W - L - R) * n);
    }
    hit.addEventListener("pointermove", function (ev) { showAt(idx(ev)); });
    hit.addEventListener("pointerdown", function (ev) { showAt(idx(ev)); });
    hit.addEventListener("pointerleave", hide);
    svg.setAttribute("aria-label", "Monthly " + (key === "visits" ? "store visits" : "Pinterest views") + " for 5 strategies over " + n + " months. " + P.list[sel].label + " strategy " + P.list[sel].name + " reaches " + fmt(series[sel][n]) + " in month " + n + ".");
  }

  // ---------- rising graph WITHOUT numbers (visits popup): today -> 6 months ----------
  function drawRise(svg, vals, opts) {
    var o = opts || {};
    svg.innerHTML = "";
    var W = 520, H = 200, P = 18;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    vals = (vals || []).slice(0, 7);
    var max = Math.max.apply(null, vals) || 1;
    var x = function (i) { return P + (W - 2 * P) * i / 6; };
    var y = function (v) { return H - 34 - (H - 34 - P - 18) * Math.pow(v / max, .85); };
    var pts = vals.map(function (v, i) { return [x(i), y(v)]; });
    var gid = "ggr" + Math.random().toString(36).slice(2, 8);
    var defs = el("defs", {}, svg);
    var lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": o.color || "#14B88F", "stop-opacity": ".55" }, lg);
    el("stop", { offset: "1", "stop-color": o.color || "#14B88F", "stop-opacity": "0" }, lg);
    var lg2 = el("linearGradient", { id: gid + "s", x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el("stop", { offset: "0", "stop-color": "#34D6A8" }, lg2);
    el("stop", { offset: "1", "stop-color": "#FFC75A" }, lg2);
    var cp = el("clipPath", { id: gid + "c" }, defs);
    var clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cp);
    for (var g = 1; g <= 3; g++) el("line", { x1: P, x2: W - P, y1: P + (H - 34 - P) * g / 3, y2: P + (H - 34 - P) * g / 3, stroke: "rgba(255,255,255,.08)" }, svg);
    var plot = el("g", { "clip-path": "url(#" + gid + "c)" }, svg);
    var d = smooth(pts);
    el("path", { d: d + " L" + x(6) + "," + (H - 34) + " L" + x(0) + "," + (H - 34) + " Z", fill: "url(#" + gid + ")" }, plot);
    el("path", { d: d, fill: "none", stroke: "url(#" + gid + "s)", "stroke-width": 5, "stroke-linecap": "round" }, plot);
    var t1 = el("text", { x: P, y: H - 10, fill: "rgba(255,255,255,.6)", "font-family": "Figtree,system-ui,sans-serif", "font-size": 13, "font-weight": 600 }, svg);
    t1.textContent = "Today";
    var t2 = el("text", { x: W - P, y: H - 10, fill: "rgba(255,255,255,.6)", "font-family": "Figtree,system-ui,sans-serif", "font-size": 13, "font-weight": 600, "text-anchor": "end" }, svg);
    t2.textContent = "In 6 months";
    var dot = el("circle", { r: 8, fill: "#FFC75A", cx: pts[0][0], cy: pts[0][1], opacity: 0 }, svg);
    var halo = el("circle", { r: 18, fill: "rgba(255,199,90,.25)", cx: pts[0][0], cy: pts[0][1], opacity: 0 }, svg);
    if (reduce) {
      clipRect.setAttribute("width", W);
      dot.setAttribute("cx", pts[6][0]); dot.setAttribute("cy", pts[6][1]); dot.setAttribute("opacity", 1);
      return;
    }
    var path = el("path", { d: d, fill: "none", stroke: "none" }, svg);
    var len = path.getTotalLength();
    var start = null, dur = 2200;
    requestAnimationFrame(function anim(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      var pt = path.getPointAtLength(len * e);
      clipRect.setAttribute("width", (pt.x + 2).toFixed(1));
      dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y); dot.setAttribute("opacity", 1);
      halo.setAttribute("cx", pt.x); halo.setAttribute("cy", pt.y); halo.setAttribute("opacity", 1);
      if (k < 1) requestAnimationFrame(anim);
      else if (halo.animate) halo.animate([{ r: 14, opacity: .9 }, { r: 26, opacity: 0 }], { duration: 1400, iterations: Infinity });
    });
  }

  // ---------- the full forecast widget ----------
  // mount(container, input, opts)
  //   input: same as plan() + { pinsLive: true when the pin count came from the Pinterest API }
  //   opts:  { edit: true to show niche / pins pickers, onChange(field, value), range: 3|6, metric }
  // returns { update(newInput), plan() }
  function mount(root, input, opts) {
    opts = opts || {};
    var S = { input: input || {}, range: opts.range === 6 ? 6 : 3, metric: opts.metric === "visits" ? "visits" : "views", sel: 0, P: null, drawn: false };
    root.innerHTML =
      '<div class="gw">' +
      '<span class="gw-orb a"></span><span class="gw-orb b"></span>' +
      '<div class="gw-top"><span class="gw-kick"><i></i>Your personal growth forecast</span><div class="gw-chips" data-k="chips"></div></div>' +
      '<div><p class="gw-lead" data-k="lead"></p>' +
      '<div class="gw-big"><div><b data-k="bigV">0</b><small data-k="bigVl">Pinterest views</small></div><span class="plus">+</span><div class="v2"><b data-k="bigS">0</b><small data-k="bigSl">store visits</small></div></div>' +
      '<p class="gw-sub" data-k="sub"></p><div class="gw-vs" data-k="vs"></div></div>' +
      '<div class="gw-ctrl"><div class="gw-seg" data-k="rng"><span class="knob"></span><button type="button" data-v="3">3 months</button><button type="button" data-v="6">6 months</button></div>' +
      '<div class="gw-seg" data-k="met"><span class="knob"></span><button type="button" data-v="views">Views</button><button type="button" data-v="visits">Store visits</button></div></div>' +
      '<div class="gw-chart"><svg role="img"></svg></div>' +
      '<p class="gw-cap" data-k="cap" style="margin:-8px 0 0"></p>' +
      '<div class="gw-board" data-k="board" role="list"></div>' +
      '<h3 class="gw-h3" data-k="mh"></h3><div class="gw-months" data-k="months"></div>' +
      '<div class="gw-stats" data-k="stats"></div>' +
      '<p class="gw-fine" data-k="fine"></p>' +
      '</div>';
    function q(k) { return root.querySelector('[data-k="' + k + '"]'); }
    var svg = root.querySelector(".gw-chart svg");

    function seg(box, val) {
      var bs = box.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("on", bs[i].getAttribute("data-v") === String(val));
      box.classList.toggle("r2", String(val) === bs[1].getAttribute("data-v"));
    }
    q("rng").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; S.range = Number(b.getAttribute("data-v")); render(true); });
    q("met").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; S.metric = b.getAttribute("data-v"); render(true); });
    q("board").addEventListener("click", function (e) { var b = e.target.closest("[data-i]"); if (!b) return; S.sel = Number(b.getAttribute("data-i")); render(true); });
    q("chips").addEventListener("change", function (e) {
      var s = e.target;
      if (!s.getAttribute("data-f")) return;
      var f = s.getAttribute("data-f"), v = s.value;
      if (f === "niche") S.input.niche = v;
      if (f === "pins") S.input.pins = Number(v);
      render(true);
      if (opts.onChange) opts.onChange(f, f === "pins" ? Number(v) : v);
    });

    function chips(P) {
      var h = "";
      var i0 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
      if (opts.edit) {
        h += '<label class="gw-chip sel' + (P.nicheKnown ? "" : " ask") + '">' + i0 + '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><select data-f="niche" aria-label="What do you sell">' +
          (P.nicheKnown ? "" : '<option value="" selected disabled>What do you sell?</option>') +
          niches().map(function (n) { return '<option' + (P.nicheKnown && n === P.niche ? " selected" : "") + '>' + esc(n) + '</option>'; }).join("") + '</select></label>';
      } else {
        h += '<span class="gw-chip">' + i0 + '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>' + esc(P.nicheKnown ? P.niche : "All shops") + '</span>';
      }
      var pinIc = i0 + '<path d="M12 22v-6M8 3h8l-1 6 3 4H6l3-4z"/></svg>';
      if (P.pinsLive) {
        h += '<span class="gw-chip live">' + pinIc + fmtFull(P.pins) + ' pins (live)</span>';
      } else if (opts.edit) {
        h += '<label class="gw-chip sel' + (P.pinsKnown ? "" : " ask") + '">' + pinIc + '<select data-f="pins" aria-label="Pins on your Pinterest">' +
          (P.pinsKnown ? "" : '<option value="" selected disabled>Pins on your Pinterest?</option>') +
          PIN_TIERS.map(function (t, k) { return '<option value="' + t.value + '"' + (P.pinsKnown && k === P.pinsTier ? " selected" : "") + '>' + t.label + '</option>'; }).join("") + '</select></label>';
      } else if (P.pinsKnown) {
        h += '<span class="gw-chip">' + pinIc + PIN_TIERS[P.pinsTier].short + '</span>';
      }
      h += '<span class="gw-chip">' + i0 + '<path d="M4 9h16l-1 11H5z"/><path d="M9 9V7a3 3 0 016 0v2"/></svg>' + esc(P.store) + ' store</span>';
      if (P.current > 0) h += '<span class="gw-chip live">' + i0 + '<path d="M3 17l6-6 4 4 8-8"/></svg>Now ' + fmt(P.current) + ' views/mo</span>';
      return h;
    }

    function render(quick) {
      var P = S.P = plan(S.input);
      var n = S.range, s = P.list[S.sel] || P.list[0], best = P.best, worst = P.worst;
      var isV = S.metric === "views";
      q("chips").innerHTML = chips(P);
      seg(q("rng"), n); seg(q("met"), S.metric);

      var tv = sum(s.views, n), ts = sum(s.visits, n);
      q("lead").innerHTML = "With the " + (S.sel === 0 ? '<span class="gw-tag" style="background:' + s.color + '">' + CROWN.replace("<svg", '<svg width="12" height="12"') + ' Best</span> strategy, <b>' + esc(s.name) + '</b>,' : '<b style="color:' + s.color + '">' + esc(s.label) + '</b> strategy, <b>' + esc(s.name) + '</b>,') + " your " + esc(P.nicheKnown ? P.niche.toLowerCase() + " " : "") + "shop can get in the next " + n + " months";
      countUp(q("bigV"), tv, quick ? 900 : 1600);
      countUp(q("bigS"), ts, quick ? 900 : 1800, fmtFull);
      q("bigVl").textContent = "Pinterest views";
      q("bigSl").textContent = P.store + " store visits";
      q("sub").textContent = "All " + n + " months added up. Month " + n + " alone: " + fmt(s.views[n]) + " views and " + fmtFull(s.visits[n]) + " store visits.";
      var bTot = sum(best.views, n), wTot = Math.max(1, sum(worst.views, n));
      if (S.sel === 0) q("vs").innerHTML = BOLT + "<span>" + (bTot / wTot).toFixed(1).replace(/\.0$/, "") + "x more views than the worst strategy (" + esc(worst.name) + ": " + fmt(sum(worst.views, n)) + ")</span>";
      else q("vs").innerHTML = BOLT + "<span>The Best strategy, " + esc(best.name) + ", gets " + fmt(bTot) + " views, " + (bTot / Math.max(1, tv)).toFixed(1).replace(/\.0$/, "") + "x more than this one</span>";

      drawRace(svg, P, { range: n, metric: S.metric, sel: S.sel, goal: isV ? P.goalViews : P.goalVisits, ms: S.drawn ? 800 : 1600 });
      S.drawn = true;
      q("cap").textContent = "Monthly " + (isV ? "Pinterest views" : P.store + " store visits") + " for each strategy. Tap the graph to see any month, or tap a strategy below.";

      // leaderboard
      var vals = P.list.map(function (x) { return sum(x[S.metric], n); });
      var topV = Math.max.apply(null, vals.concat([1]));
      q("board").innerHTML = P.list.map(function (x, k) {
        var v = vals[k];
        return '<button type="button" role="listitem" class="gw-row' + (k === S.sel ? " on" : "") + '" data-i="' + k + '" style="--c:' + x.color + '" aria-pressed="' + (k === S.sel) + '">' +
          '<span class="gw-badge">' + (k === 0 ? CROWN : "") + esc(x.label) + '</span>' +
          '<span class="gw-nm"><b>' + esc(x.name) + (k === 0 ? '<span class="gw-runs">GrowMyPin runs this</span>' : '<em>' + esc(x.short) + '</em>') + '</b><span class="gw-bar"><i data-w="' + Math.max(3, 100 * v / topV).toFixed(1) + '%"></i></span></span>' +
          '<span class="gw-val"><b>' + (isV ? fmt(v) : fmtFull(v)) + '</b><small>' + (isV ? "views" : "visits") + " in " + n + ' mo</small></span></button>';
      }).join("");
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        var bars = root.querySelectorAll(".gw-bar i");
        for (var i = 0; i < bars.length; i++) bars[i].style.width = bars[i].getAttribute("data-w");
      }); });

      // month by month
      q("mh").textContent = "Month by month with " + s.name;
      var crossed = {};
      var mh = "";
      for (var m = 1; m <= n; m++) {
        var badge = "";
        for (var z = 0; z < MILESTONES.length; z++) {
          var t = MILESTONES[z];
          if (s.views[m] >= t && s.views[m - 1] < t && !crossed[t]) { badge = fmt(t) + "+ views"; crossed[t] = 1; break; }
        }
        mh += '<div class="gw-m' + (m === n ? " up" : "") + '" style="animation-delay:' + (m * 70) + 'ms">' + (badge ? '<span class="ms">' + badge + '</span>' : "") +
          '<span class="t">Month ' + m + '</span>' +
          '<b>' + (isV ? fmt(s.views[m]) : fmtFull(s.visits[m])) + '</b>' +
          '<small>' + (isV ? "views, " + fmtFull(s.visits[m]) + " visits" : "visits, " + fmt(s.views[m]) + " views") + '</small>' +
          '<span class="p">' + esc(PHASES[m - 1] || "") + '</span></div>';
      }
      q("months").innerHTML = mh;

      // totals + goal
      var salesTot = sum(s.sales, n);
      var goalTxt, goalSub;
      if (P.target) {
        var hit = 0;
        for (var g2 = 1; g2 <= 6; g2++) if (s.sales[g2] >= P.target) { hit = g2; break; }
        if (hit && hit <= n) { goalTxt = "Month " + hit; goalSub = "your goal of " + fmtFull(P.target) + " sales a month is reached"; }
        else { goalTxt = Math.min(100, Math.round(100 * s.sales[n] / P.target)) + "%"; goalSub = "of your " + fmtFull(P.target) + " sales a month goal by month " + n; }
      } else {
        goalTxt = fmtFull(Math.round(s.sales[n])); goalSub = "estimated sales in month " + n;
      }
      q("stats").innerHTML =
        '<div><b>' + fmt(tv) + '</b><small>total Pinterest views in ' + n + ' months</small></div>' +
        '<div><b>' + fmtFull(ts) + '</b><small>total ' + esc(P.store) + ' store visits in ' + n + ' months</small></div>' +
        '<div><b>' + (salesTot >= 1 ? fmtFull(Math.round(salesTot)) : "1+") + '</b><small>estimated sales in ' + n + ' months</small></div>' +
        '<div class="gold"><b>' + goalTxt + '</b><small>' + goalSub + '</small></div>';

      q("fine").textContent = "Estimate for " + (P.nicheKnown ? P.niche.toLowerCase() : "average") + " shops" + (P.pinsKnown ? " with " + PIN_TIERS[P.pinsTier].label.toLowerCase() : "") +
        ", based on results of GrowMyPin client accounts. Not a guarantee: real results depend on your products, photos, prices, your " + P.store + " listing and Pinterest itself.";
      if (opts.onRender) opts.onRender(P, S);
    }

    var lastNarrow = null, rsT = null;
    function onResize() {
      clearTimeout(rsT);
      rsT = setTimeout(function () {
        if (!root.isConnected) { window.removeEventListener("resize", onResize); return; }
        var nw = (svg.clientWidth || 700) < 520;
        if (lastNarrow !== null && nw !== lastNarrow) drawRace(svg, S.P, { range: S.range, metric: S.metric, sel: S.sel, goal: S.metric === "views" ? S.P.goalViews : S.P.goalVisits, ms: 0 });
        lastNarrow = nw;
      }, 200);
    }
    window.addEventListener("resize", onResize);
    render();
    lastNarrow = (svg.clientWidth || 700) < 520;
    return {
      update: function (inp) { S.input = inp || S.input; render(true); },
      plan: function () { return S.P; },
      state: S
    };
  }

  window.GMPGrowth = {
    NAMES: NAMES, RANK_LABELS: RANK_LABELS, COLORS: COLORS, PIN_TIERS: PIN_TIERS,
    setConfig: setConfig, config: function () { return CFG; }, niches: niches, pinsTier: pinsTier,
    plan: plan, total: sum, pickPlatform: pickPlatform,
    fmt: fmt, fmtFull: fmtFull, countUp: countUp, drawRace: drawRace, drawRise: drawRise, mount: mount, reduce: reduce
  };
})();
