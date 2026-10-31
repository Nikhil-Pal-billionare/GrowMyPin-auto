// GrowMyPin growth forecast. Shared by home.html, signup.html, the visits popup (gmp.js),
// the plans popup (gmp-plans.js) and the admin preview, so every page shows the same numbers.
//
// The numbers come from Admin > Growth graph (settings.growth):
//   niches[].views[month]  = Pinterest views in month 1 to 6 (monthly total) for an account starting at zero
//   patience               = how many first months are "Patience" (orange) before "Reward" (green)
// A seller's forecast = their current monthly views + the graph of their niche.
// Sellers only see "your Pinterest can reach ...". Nothing here shows the niche or the method.
(function () {
  if (window.GMPGrowth) return;
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var NAMES = { etsy: "Etsy", shopify: "Shopify", ebay: "eBay" };
  var ORDER = ["etsy", "shopify", "ebay"];
  var PHASES = ["Pinterest learns your shop", "Your first pins start ranking", "Views take off", "Buyers find you every day", "Your pins keep compounding", "Your shop becomes a Pinterest brand"];
  var MILESTONES = [1000000, 500000, 200000, 100000, 50000, 25000, 10000];
  var DISCLAIMER = "This is an estimate, not a guarantee. Actual results depend on how your pins perform, changes on Pinterest, and your products.";

  // Used only until the real settings arrive from the server.
  var FALLBACK = {
    niches: [{ name: "Other", views: [3000, 13000, 35000, 64000, 96000, 130000] }],
    patience: 2
  };
  var CFG = FALLBACK;

  function setConfig(g) {
    if (g && g.niches && g.niches.length && Array.isArray(g.niches[0].views) && typeof g.niches[0].views[0] === "number") CFG = g;
    return CFG;
  }

  function sum(a, n) { var s = 0; for (var i = 1; i <= n && i < a.length; i++) s += a[i]; return s; }
  function niches() { return CFG.niches.map(function (n) { return n.name; }); }
  function findNiche(name) {
    var w = String(name || "").toLowerCase();
    for (var i = 0; i < CFG.niches.length; i++) if (CFG.niches[i].name.toLowerCase() === w) return CFG.niches[i];
    return null;
  }
  function pickPlatform(list) {
    list = list || [];
    for (var i = 0; i < ORDER.length; i++) if (list.indexOf(ORDER[i]) > -1) return ORDER[i];
    return "";
  }

  // input: { niche, platform, current (monthly views now) }
  // returns views[0..6]: views[0] = now, views[m] = monthly views in month m.
  // patience = the first REWARD month (months before it are patience).
  function plan(input) {
    var o = input || {};
    var N = findNiche(o.niche);
    var known = !!N;
    if (!N) N = findNiche("Other") || CFG.niches[CFG.niches.length - 1];
    var cur = Math.max(0, Math.round(Number(o.current) || 0));
    var views = [cur];
    for (var i = 0; i < 6; i++) views.push(Math.round(cur + (Number(N.views[i]) || 0)));
    var pm = Math.max(1, Math.min(3, Math.round(Number(CFG.patience) || 2)));
    var platform = NAMES[o.platform] ? o.platform : "etsy";
    var est = { id: "estimate", views: views, patience: pm + 1 };
    return {
      niche: N.name, nicheKnown: known, platform: platform, store: NAMES[platform], current: cur,
      views: views, patience: pm + 1, best: est, worst: est, list: [est]
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
    ".gw{--gw-ink:#24292F;--gw-mut:#59606E;--gw-line:#E6E8EF;--gw-soft:#F7F7FB;--gw-pat:#E8902A;--gw-pat-bg:#FFF5E6;--gw-rew:#0F9682;--gw-rew-bg:#E8F7F1;" +
    "position:relative;isolation:isolate;overflow:hidden;border-radius:28px;color:var(--gw-ink);padding:clamp(18px,3.4vw,30px);display:grid;gap:18px;font-family:Figtree,system-ui,sans-serif;" +
    "background:radial-gradient(60% 50% at 100% 0%,rgba(20,184,143,.12) 0,transparent 70%),radial-gradient(55% 45% at 0% 100%,rgba(242,154,46,.10) 0,transparent 70%),#FFFFFF;border:1px solid var(--gw-line);box-shadow:0 30px 60px -40px rgba(36,41,47,.35)}" +
    ".gw *{box-sizing:border-box}" +
    ".gw-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}" +
    ".gw-kick{display:inline-flex;align-items:center;gap:8px;font-size:.8rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--gw-rew)}" +
    ".gw-kick i{width:8px;height:8px;border-radius:50%;background:#14B88F;box-shadow:0 0 0 0 rgba(20,184,143,.5);animation:gwPing 1.8s infinite}" +
    ".gw-chip{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #BDE8DA;background:#F0FAF6;color:#0B7A69;border-radius:999px;padding:7px 12px;font-size:.84rem;font-weight:700;white-space:nowrap}" +
    ".gw-chip svg{width:14px;height:14px;flex:none}" +
    ".gw-lead{margin:0;font-size:clamp(1rem,2.2vw,1.18rem);color:var(--gw-mut);line-height:1.45}" +
    ".gw-big{display:grid;gap:2px;margin-top:6px}" +
    ".gw-big b{font-family:Montserrat,system-ui,sans-serif;font-weight:800;letter-spacing:-.045em;line-height:.95;font-size:clamp(2.6rem,8.4vw,4.4rem);background:linear-gradient(135deg,#09423D 0%,#0F8A76 55%,#14B88F 100%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gw-big small{font-size:.9rem;color:var(--gw-mut);font-weight:700}" +
    ".gw-sub{margin:4px 0 0;color:var(--gw-mut);font-size:.95rem}" +
    ".gw-ctrl{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}" +
    ".gw-seg{display:inline-grid;grid-template-columns:1fr 1fr;background:#F1EEFB;border-radius:999px;padding:4px;position:relative}" +
    ".gw-seg button{position:relative;z-index:1;border:0;background:none;font:inherit;font-weight:800;font-size:.86rem;padding:8px 15px;border-radius:999px;cursor:pointer;color:var(--gw-mut);transition:color .25s;white-space:nowrap}" +
    ".gw-seg button.on{color:#fff}" +
    ".gw-seg .knob{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:999px;background:linear-gradient(135deg,#09423D,#0F8A76 55%,#14B88F);transition:transform .4s cubic-bezier(.2,.8,.2,1)}" +
    ".gw-seg.r2 .knob{transform:translateX(100%)}" +
    ".gw-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:.84rem;font-weight:700;color:var(--gw-ink)}" +
    ".gw-legend span{display:inline-flex;align-items:center;gap:7px}" +
    ".gw-legend i{width:22px;height:5px;border-radius:4px;display:inline-block}" +
    ".gw-legend small{font-weight:600;color:var(--gw-mut)}" +
    ".gw-cap{font-size:.82rem;color:var(--gw-mut);margin:-8px 0 0}" +
    ".gw-chart{position:relative;border-radius:20px;background:#fff;border:1px solid var(--gw-line);padding:10px 6px 4px}" +
    ".gw-chart svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}" +
    ".gw-ax{font-family:Figtree,system-ui,sans-serif;font-size:11px;fill:#8A90A0}" +
    ".gw-vl{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:11.5px;fill:#24292F;transition:opacity .3s}" +
    ".gw-zt{font-family:Figtree,system-ui,sans-serif;font-size:10.5px;font-weight:800;letter-spacing:.08em}" +
    ".gw-tip rect{fill:#fff;stroke:#E4E6EE;filter:drop-shadow(0 10px 18px rgba(36,41,47,.16))}.gw-tip text{font-family:Figtree,system-ui,sans-serif;font-size:11.5px;fill:#59606E}.gw-tip .h{font-weight:800;fill:#24292F}" +
    ".gw-h3{margin:0;font-family:Montserrat,system-ui,sans-serif;font-size:1.02rem;letter-spacing:-.01em;color:var(--gw-ink)}" +
    ".gw-months{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}" +
    ".gw-m{position:relative;border-radius:16px;padding:12px;border:1.5px solid var(--gw-line);display:grid;gap:3px;opacity:0;transform:translateY(10px);animation:gwRise .5s cubic-bezier(.2,.8,.2,1) forwards}" +
    ".gw-m.pat{background:var(--gw-pat-bg);border-color:#F7DDB4}" +
    ".gw-m.rew{background:var(--gw-rew-bg);border-color:#BDE8DA}" +
    ".gw-m .t{display:flex;justify-content:space-between;gap:6px;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--gw-mut)}" +
    ".gw-m .t em{font-style:normal;letter-spacing:.04em}" +
    ".gw-m.pat .t em{color:#B4601A}.gw-m.rew .t em{color:#0B7A69}" +
    ".gw-m b{font-family:Montserrat,system-ui,sans-serif;font-size:1.3rem;letter-spacing:-.03em}" +
    ".gw-m small{font-size:.76rem;color:var(--gw-mut)}" +
    ".gw-m .p{font-size:.74rem;color:var(--gw-mut);line-height:1.3}" +
    ".gw-m .ms{position:absolute;top:-10px;right:8px;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:800;color:#fff;background:linear-gradient(135deg,#0F8A76,#14B88F);box-shadow:0 6px 14px -6px rgba(15,150,130,.8)}" +
    ".gw-fine{margin:0;padding:10px 12px;border-radius:14px;background:var(--gw-soft);border:1px solid var(--gw-line);font-size:.8rem;color:#59606E;line-height:1.45}" +
    "@keyframes gwPing{0%{box-shadow:0 0 0 0 rgba(20,184,143,.5)}80%,100%{box-shadow:0 0 0 10px rgba(20,184,143,0)}}" +
    "@keyframes gwRise{to{opacity:1;transform:none}}" +
    "@media (max-width:640px){.gw-months{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    "@media (prefers-reduced-motion:reduce){.gw-kick i{animation:none}.gw-m{opacity:1;transform:none;animation:none}}";
  document.head.appendChild(css);

  var PAT = "#E8902A", REW = "#0F9682";

  // ---------- patience + reward chart (one line) ----------
  // opts: { range: 3|6, ms: animation ms }
  function drawChart(svg, P, opts) {
    var o = opts || {};
    var n = o.range || 3;
    var vals = P.views.slice(0, n + 1);
    svg.innerHTML = "";
    var cw = svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 680;
    var narrow = cw < 520;
    var W = narrow ? Math.max(300, Math.round(cw)) : 700, H = narrow ? 280 : 330;
    var L = narrow ? 40 : 48, R = narrow ? 14 : 78, T = 40, B = 34;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var maxData = Math.max.apply(null, vals.concat([1]));
    var raw = maxData * 1.08 / 4;
    var p10 = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
    var f = raw / p10;
    var top = 4 * p10 * (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10);
    var x = function (i) { return L + (W - L - R) * i / n; };
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var gid = "gw" + Math.random().toString(36).slice(2, 8);
    var split = Math.min(n, Math.max(1, P.patience - 1)); // month where patience ends and reward starts
    var xs = x(split);

    var defs = el("defs", {}, svg);
    function grad(id, c, a) {
      var lg = el("linearGradient", { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el("stop", { offset: "0", "stop-color": c, "stop-opacity": a }, lg);
      el("stop", { offset: "1", "stop-color": c, "stop-opacity": "0" }, lg);
    }
    grad(gid + "p", PAT, ".30"); grad(gid + "r", REW, ".32");
    var cpA = el("clipPath", { id: gid + "c" }, defs);
    var clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cpA);
    var cpP = el("clipPath", { id: gid + "cp" }, defs);
    el("rect", { x: 0, y: 0, width: xs, height: H }, cpP);
    var cpR = el("clipPath", { id: gid + "cr" }, defs);
    el("rect", { x: xs, y: 0, width: W - xs, height: H }, cpR);

    el("rect", { x: L, y: T - 6, width: xs - L, height: H - B - T + 6, fill: "#FFF5E6", rx: 10 }, svg);
    el("rect", { x: xs, y: T - 6, width: W - R - xs, height: H - B - T + 6, fill: "#F0FAF6", rx: 10 }, svg);
    el("text", { "class": "gw-zt", x: (L + xs) / 2, y: T - 14, "text-anchor": "middle", fill: "#B4601A" }, svg).textContent = "PATIENCE";
    el("text", { "class": "gw-zt", x: (xs + W - R) / 2, y: T - 14, "text-anchor": "middle", fill: "#0B7A69" }, svg).textContent = "REWARD";
    el("line", { x1: xs, x2: xs, y1: T - 6, y2: H - B, stroke: "#E2C9A0", "stroke-dasharray": "3 4" }, svg);

    var grid = el("g", {}, svg);
    for (var g = 1; g <= 4; g++) {
      var gv = top * g / 4;
      el("line", { x1: L, x2: W - R, y1: y(gv), y2: y(gv), stroke: "rgba(36,41,47,.06)" }, grid);
      el("text", { "class": "gw-ax", x: L - 8, y: y(gv) + 4, "text-anchor": "end" }, grid).textContent = fmt(gv);
    }
    el("line", { x1: L, x2: W - R, y1: y(0), y2: y(0), stroke: "#D9DCE5" }, grid);
    el("text", { "class": "gw-ax", x: L - 8, y: y(0) + 4, "text-anchor": "end" }, grid).textContent = "0";
    for (var m = 0; m <= n; m++) {
      el("text", { "class": "gw-ax", x: x(m), y: H - 10, "text-anchor": "middle", "font-weight": m === n ? 800 : 500 }, grid).textContent = m === 0 ? "Now" : (narrow ? "M" + m : "Month " + m);
    }

    var plot = el("g", { "clip-path": "url(#" + gid + "c)" }, svg);
    var pts = vals.map(function (v, i) { return [x(i), y(v)]; });
    var sd = smooth(pts);
    var area = sd + " L" + x(n) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z";
    var gp = el("g", { "clip-path": "url(#" + gid + "cp)" }, plot);
    el("path", { d: area, fill: "url(#" + gid + "p)" }, gp);
    el("path", { d: sd, fill: "none", stroke: PAT, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, gp);
    var gr = el("g", { "clip-path": "url(#" + gid + "cr)" }, plot);
    el("path", { d: area, fill: "url(#" + gid + "r)" }, gr);
    el("path", { d: sd, fill: "none", stroke: REW, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round" }, gr);

    var dots = el("g", {}, svg);
    var ms = o.ms === undefined ? 1500 : o.ms;
    pts.forEach(function (p, i) {
      if (i === 0 && !vals[0]) return;
      var c = i < split ? PAT : REW;
      var dot = el("circle", { cx: p[0], cy: p[1], r: reduce || !ms ? 5 : 0, fill: "#fff", stroke: c, "stroke-width": 3, style: "transition:r .3s" }, dots);
      var lb = null;
      if ((!narrow || i === n || n <= 3) && i > 0) {
        lb = el("text", { "class": "gw-vl", x: p[0], y: p[1] - 12, "text-anchor": "middle", opacity: reduce || !ms ? 1 : 0 }, dots);
        lb.textContent = fmt(vals[i]);
      }
      if (!reduce && ms) setTimeout(function () { dot.setAttribute("r", i === n ? 7 : 5); if (lb) lb.setAttribute("opacity", 1); }, 200 + ms * i / n);
    });
    if (!narrow) {
      var pill = el("g", { transform: "translate(" + (W - R + 10) + " " + (pts[n][1] - 12) + ")", opacity: reduce || !ms ? 1 : 0, style: "transition:opacity .4s" }, svg);
      el("rect", { width: 66, height: 24, rx: 12, fill: REW }, pill);
      el("text", { x: 33, y: 16, "text-anchor": "middle", "font-family": "Montserrat,system-ui,sans-serif", "font-weight": 800, "font-size": 12, fill: "#fff" }, pill).textContent = fmt(vals[n]);
      if (!reduce && ms) setTimeout(function () { pill.setAttribute("opacity", 1); }, ms + 150);
    }
    reveal(clipRect, W, ms);

    // tooltip: hover or tap a month
    var guide = el("line", { x1: 0, x2: 0, y1: T - 6, y2: H - B, stroke: "rgba(36,41,47,.3)", "stroke-dasharray": "3 4", opacity: 0 }, svg);
    var tip = el("g", { "class": "gw-tip", opacity: 0, "pointer-events": "none" }, svg);
    var tw = 150, th = 44;
    el("rect", { width: tw, height: th, rx: 12 }, tip);
    var tHead = el("text", { "class": "h", x: 12, y: 18 }, tip);
    var tVal = el("text", { x: 12, y: 35 }, tip);
    function showAt(i) {
      i = Math.max(0, Math.min(n, i));
      guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("opacity", 1);
      tHead.textContent = i === 0 ? "Now" : "Month " + i;
      tVal.textContent = fmtFull(vals[i]) + " views";
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
    svg.setAttribute("aria-label", "Monthly Pinterest views over " + n + " months. Patience until month " + split + ", then reward, reaching " + fmt(vals[n]) + " in month " + n + ".");
  }

  // ---------- rising graph WITHOUT numbers (popups): today -> 6 months ----------
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
    el("stop", { offset: "0", "stop-color": o.color || "#4BE3B4", "stop-opacity": ".45" }, lg);
    el("stop", { offset: "1", "stop-color": o.color || "#4BE3B4", "stop-opacity": "0" }, lg);
    var lg2 = el("linearGradient", { id: gid + "s", x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el("stop", { offset: "0", "stop-color": "#FFB547" }, lg2);
    el("stop", { offset: ".3", "stop-color": "#FFB547" }, lg2);
    el("stop", { offset: ".42", "stop-color": "#4BE3B4" }, lg2);
    el("stop", { offset: "1", "stop-color": "#4BE3B4" }, lg2);
    var cp = el("clipPath", { id: gid + "c" }, defs);
    var clipRect = el("rect", { x: 0, y: 0, width: 0, height: H }, cp);
    for (var g = 1; g <= 3; g++) el("line", { x1: P, x2: W - P, y1: P + (H - 34 - P) * g / 3, y2: P + (H - 34 - P) * g / 3, stroke: "rgba(255,255,255,.08)" }, svg);
    var plot = el("g", { "clip-path": "url(#" + gid + "c)" }, svg);
    var d = smooth(pts);
    el("path", { d: d + " L" + x(6) + "," + (H - 34) + " L" + x(0) + "," + (H - 34) + " Z", fill: "url(#" + gid + ")" }, plot);
    el("path", { d: d, fill: "none", stroke: "url(#" + gid + "s)", "stroke-width": 5, "stroke-linecap": "round" }, plot);
    var t1 = el("text", { x: P, y: H - 10, fill: "rgba(255,255,255,.6)", "font-family": "Figtree,system-ui,sans-serif", "font-size": 13, "font-weight": 600 }, svg);
    t1.textContent = "Patience";
    var t2 = el("text", { x: W - P, y: H - 10, fill: "rgba(255,255,255,.6)", "font-family": "Figtree,system-ui,sans-serif", "font-size": 13, "font-weight": 600, "text-anchor": "end" }, svg);
    t2.textContent = "Reward in 6 months";
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

  // ---------- the forecast widget ----------
  // mount(container, input, opts)
  //   input: same as plan()
  //   opts:  { range: 3|6, onRender(P) }
  // returns { update(newInput), plan() }
  function mount(root, input, opts) {
    opts = opts || {};
    var S = { input: input || {}, range: opts.range === 6 ? 6 : 3, P: null, drawn: false };
    root.innerHTML =
      '<div class="gw">' +
      '<div class="gw-top"><span class="gw-kick"><i></i>Your growth forecast</span><span data-k="now"></span></div>' +
      '<div><p class="gw-lead">Your Pinterest can reach</p>' +
      '<div class="gw-big"><b data-k="big">0</b><small data-k="bigL">Pinterest views a month</small></div>' +
      '<p class="gw-sub" data-k="sub"></p></div>' +
      '<div class="gw-ctrl"><div class="gw-seg" data-k="rng"><span class="knob"></span><button type="button" data-v="3">3 months</button><button type="button" data-v="6">6 months</button></div></div>' +
      '<div class="gw-legend" data-k="leg"></div>' +
      '<div class="gw-chart"><svg role="img"></svg></div>' +
      '<p class="gw-cap">Monthly Pinterest views. Tap the graph to see any month.</p>' +
      '<h3 class="gw-h3">Month by month</h3><div class="gw-months" data-k="months"></div>' +
      '<p class="gw-fine">' + esc(DISCLAIMER) + '</p>' +
      '</div>';
    function q(k) { return root.querySelector('[data-k="' + k + '"]'); }
    var svg = root.querySelector(".gw-chart svg");

    function seg(box, val) {
      var bs = box.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("on", bs[i].getAttribute("data-v") === String(val));
      box.classList.toggle("r2", String(val) === bs[1].getAttribute("data-v"));
    }
    q("rng").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; S.range = Number(b.getAttribute("data-v")); render(true); });

    function render(quick) {
      var P = S.P = plan(S.input);
      var n = S.range, v = P.views;
      seg(q("rng"), n);
      q("now").innerHTML = P.current > 0 ? '<span class="gw-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/></svg>Now ' + fmt(P.current) + ' views a month</span>' : "";
      countUp(q("big"), v[n], quick ? 900 : 1600);
      q("bigL").textContent = "Pinterest views a month by month " + n;
      q("sub").textContent = "That is about " + fmt(sum(v, n)) + " views in total over the next " + n + " months.";

      drawChart(svg, P, { range: n, ms: S.drawn ? 800 : 1600 });
      S.drawn = true;
      var pm = P.patience - 1;
      q("leg").innerHTML = '<span><i style="background:' + PAT + '"></i>Patience <small>' + (pm === 1 ? "month 1" : "months 1 to " + pm) + ': Pinterest learns your shop</small></span>' +
        '<span><i style="background:' + REW + '"></i>Reward <small>from month ' + P.patience + ': views take off</small></span>';

      var crossed = {}, mh = "";
      for (var m = 1; m <= n; m++) {
        var badge = "";
        for (var z = 0; z < MILESTONES.length; z++) {
          var t = MILESTONES[z];
          if (v[m] >= t && v[m - 1] < t && !crossed[t]) { badge = fmt(t) + "+ views"; crossed[t] = 1; break; }
        }
        var isPat = m < P.patience;
        if (isPat) badge = "";
        mh += '<div class="gw-m ' + (isPat ? "pat" : "rew") + '" style="animation-delay:' + (m * 70) + 'ms">' + (badge ? '<span class="ms">' + badge + '</span>' : "") +
          '<span class="t">Month ' + m + '<em>' + (isPat ? "Patience" : "Reward") + '</em></span>' +
          '<b>' + fmt(v[m]) + '</b><small>views that month</small>' +
          '<span class="p">' + esc(PHASES[m - 1] || "") + '</span></div>';
      }
      q("months").innerHTML = mh;
      if (opts.onRender) opts.onRender(P, S);
    }

    var lastNarrow = null, rsT = null;
    function onResize() {
      clearTimeout(rsT);
      rsT = setTimeout(function () {
        if (!root.isConnected) { window.removeEventListener("resize", onResize); return; }
        var nw = (svg.clientWidth || 700) < 520;
        if (lastNarrow !== null && nw !== lastNarrow) drawChart(svg, S.P, { range: S.range, ms: 0 });
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
    NAMES: NAMES, DISCLAIMER: DISCLAIMER,
    setConfig: setConfig, config: function () { return CFG; }, niches: niches,
    plan: plan, total: sum, pickPlatform: pickPlatform,
    fmt: fmt, fmtFull: fmtFull, countUp: countUp, drawChart: drawChart, drawRise: drawRise, mount: mount, reduce: reduce
  };
})();
