// GrowMyPin growth model + animated charts. Shared by signup.html, home.html and the visits popup (gmp.js),
// so every page shows the same numbers for the same shop.
// These are ESTIMATES from benchmarks for new accounts posting optimized pins daily, not real data.
(function () {
  if (window.GMPGrowth) return;
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var NAMES = { etsy: "Etsy", shopify: "Shopify", ebay: "eBay" };
  var ORDER = ["etsy", "shopify", "ebay"];
  // monthly Pinterest views (average case) for month 0..6
  var CURVE = [0, 3200, 14500, 36000, 58000, 81000, 104000];
  var PLAT = { etsy: { k: 1, cvr: .025 }, shopify: { k: .85, cvr: .016 }, ebay: { k: .7, cvr: .02 } };
  var CTR = .012; // share of views that click through to the shop

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // opts: { target: 10|100|1000, hasPin: bool, startViews: real monthly views if known }
  function model(p, link, opts) {
    var o = opts || {};
    var cfg = PLAT[p] || PLAT.etsy;
    var target = o.target || 100;
    var r = rng(hash((link || p || "store") + "|" + target));
    var vary = .86 + r() * .34;
    var boost = o.hasPin ? 1.25 : 1;
    var start = o.startViews > 0 ? o.startViews : (o.hasPin ? 900 + Math.round(r() * 1400) : 0);
    var avg = CURVE.map(function (v, i) { return i === 0 ? start : Math.round(start * (1 + i * .15) + v * cfg.k * vary * boost); });
    return {
      p: p, link: link || "",
      avg: avg,
      worst: avg.map(function (v) { return Math.round(v * .5); }),
      best: avg.map(function (v) { return Math.round(v * 1.8); }),
      cvr: cfg.cvr,
      visits: avg.map(function (v) { return Math.round(v * CTR); }),
      goalViews: Math.round(target / (CTR * cfg.cvr))
    };
  }
  function sales(m, i) {
    return { lo: Math.max(0, Math.round(m.worst[i] * CTR * m.cvr)), hi: Math.max(1, Math.round(m.best[i] * CTR * m.cvr)) };
  }
  function pickPlatform(list) {
    list = list || [];
    for (var i = 0; i < ORDER.length; i++) if (list.indexOf(ORDER[i]) > -1) return ORDER[i];
    return "";
  }
  function fmt(n) {
    n = Math.round(n || 0);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "K";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }
  function countUp(el, to, ms, f) {
    f = f || fmt;
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
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }
  function revealLeftToRight(clipRect, W, ms) {
    if (reduce) { clipRect.setAttribute("width", W); return; }
    var start = null;
    requestAnimationFrame(function anim(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / (ms || 1400));
      clipRect.setAttribute("width", (W * (1 - Math.pow(1 - k, 3))).toFixed(1));
      if (k < 1) requestAnimationFrame(anim);
    });
  }

  var css = document.createElement("style");
  css.textContent =
    ".gg-grid line{stroke:#EEF0F5}.gg-ax text{font-family:Figtree,system-ui,sans-serif;font-size:11px;fill:#8A90A0}" +
    ".gg-band{fill:rgba(15,150,130,.12)}.gg-line{fill:none;stroke:#0F9682;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}" +
    ".gg-goal{stroke:#F29A2E;stroke-width:2;stroke-dasharray:6 6;fill:none}.gg-goal-t{font-family:Figtree,system-ui,sans-serif;font-size:11.5px;font-weight:700;fill:#B4601A}" +
    ".gg-when{stroke:#6B5BD6;stroke-width:1.5;stroke-dasharray:3 4}.gg-when-t{font-family:Figtree,system-ui,sans-serif;font-size:11px;font-weight:700;fill:#6B5BD6}" +
    ".gg-dot{fill:#fff;stroke:#0F9682;stroke-width:3;transition:r .3s}.gg-lbl{font-family:Montserrat,system-ui,sans-serif;font-weight:700;font-size:12px;fill:#24292F;transition:opacity .3s}";
  document.head.appendChild(css);

  // Full forecast chart with axes, worst-best band, goal line and timeline marker.
  // opts: { range: 3|6, target, wait }
  function drawChart(svg, m, opts) {
    var o = opts || {};
    var n = o.range || 3;
    svg.innerHTML = "";
    var narrow = (svg.clientWidth || 640) < 520;
    var W = narrow ? Math.max(300, Math.round(svg.clientWidth)) : 640, H = narrow ? 260 : 300, L = 44, Rr = 14, T = 26, B = 34;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var avg = m.avg.slice(0, n + 1), best = m.best.slice(0, n + 1), worst = m.worst.slice(0, n + 1);
    var maxData = Math.max.apply(null, best);
    var goalOn = o.target && m.goalViews <= maxData * 1.25;
    var top = Math.max(maxData, goalOn ? m.goalViews : 0) * 1.08 || 1;
    var x = function (i) { return L + (W - L - Rr) * i / n; };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var gid = "ggf" + Math.random().toString(36).slice(2, 8);

    var defs = el("defs", {}, svg);
    var lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": "#0F9682", "stop-opacity": ".32" }, lg);
    el("stop", { offset: "1", "stop-color": "#0F9682", "stop-opacity": "0" }, lg);
    var cp = el("clipPath", { id: gid + "c" }, defs);
    var clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cp);

    var grid = el("g", { "class": "gg-grid" }, svg);
    var ax = el("g", { "class": "gg-ax" }, svg);
    for (var g = 0; g <= 4; g++) {
      var gv = top * g / 4;
      el("line", { x1: L, x2: W - Rr, y1: y(gv), y2: y(gv) }, grid);
      el("text", { x: L - 8, y: y(gv) + 4, "text-anchor": "end" }, ax).textContent = fmt(gv);
    }
    for (var mm = 0; mm <= n; mm++) {
      el("text", { x: x(mm), y: H - 10, "text-anchor": "middle" }, ax).textContent = mm === 0 ? "Now" : (narrow && n > 3 ? "M" + mm : "Month " + mm);
    }
    var plot = el("g", { "clip-path": "url(#" + gid + "c)" }, svg);
    var bestPts = best.map(function (v, i) { return [x(i), y(v)]; });
    var worstPts = worst.map(function (v, i) { return [x(i), y(v)]; }).reverse();
    el("path", { "class": "gg-band", d: smooth(bestPts) + " L" + worstPts[0][0] + "," + worstPts[0][1] + smooth(worstPts).replace(/^M[^C]*/, "") + " Z" }, plot);
    var pts = avg.map(function (v, i) { return [x(i), y(v)]; });
    var lineD = smooth(pts);
    el("path", { d: lineD + " L" + x(n) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z", fill: "url(#" + gid + ")" }, plot);
    el("path", { "class": "gg-line", d: lineD }, plot);

    if (o.target) {
      if (goalOn) {
        el("line", { "class": "gg-goal", x1: L, x2: W - Rr, y1: y(m.goalViews), y2: y(m.goalViews) }, svg);
        el("text", { "class": "gg-goal-t", x: L + 6, y: y(m.goalViews) - 7 }, svg).textContent = narrow ? "Goal: " + o.target + " sales/mo" : "Your goal: " + o.target + " sales a month";
      } else {
        el("text", { "class": "gg-goal-t", x: W - Rr, y: 14, "text-anchor": "end" }, svg).textContent = narrow ? "Goal needs " + fmt(m.goalViews) + " views/mo" : "Your goal (" + o.target + " sales) needs about " + fmt(m.goalViews) + " views a month";
      }
    }
    if (o.wait && o.wait <= n) {
      el("line", { "class": "gg-when", x1: x(o.wait), x2: x(o.wait), y1: T - 4, y2: H - B }, svg);
      el("text", { "class": "gg-when-t", x: x(o.wait) - 6, y: T + 10, "text-anchor": "end" }, svg).textContent = "Your timeline";
    }
    var dotsG = el("g", {}, svg);
    pts.forEach(function (p, i) {
      if (i === 0) return;
      var c = el("circle", { "class": "gg-dot", cx: p[0], cy: p[1], r: reduce ? 5.5 : 0 }, dotsG);
      var lb = el("text", { "class": "gg-lbl", x: p[0], y: p[1] - 12, "text-anchor": "middle", opacity: reduce ? 1 : 0 }, dotsG);
      lb.textContent = fmt(avg[i]);
      if (!reduce) setTimeout(function () { c.setAttribute("r", 5.5); lb.setAttribute("opacity", 1); }, 300 + 1100 * i / n);
    });
    revealLeftToRight(clipRect, W, 1400);
  }

  // A rising graph WITHOUT numbers (for the visits popup): today -> 6 months.
  // opts: { color, label }
  function drawRise(svg, m, opts) {
    var o = opts || {};
    svg.innerHTML = "";
    var W = 520, H = 200, P = 18;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var vals = m.visits.slice(0, 7);
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
    // glowing dot that rides the line
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
      else halo.animate && halo.animate([{ r: 14, opacity: .9 }, { r: 26, opacity: 0 }], { duration: 1400, iterations: Infinity });
    });
  }

  window.GMPGrowth = {
    NAMES: NAMES, CTR: CTR, model: model, sales: sales, pickPlatform: pickPlatform,
    fmt: fmt, countUp: countUp, drawChart: drawChart, drawRise: drawRise, reduce: reduce
  };
})();
