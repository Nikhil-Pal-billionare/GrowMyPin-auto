// GrowMyPin Studio plans + Razorpay checkout (used by home.html).
// Plans are shown only AFTER the person connects Pinterest, at the moment they see their real numbers:
//   scene 1 "Connected"  -> their real Pinterest views + pins count up
//   scene 2 "Potential"  -> their 3 month growth (patience -> reward)
//   scene 3 "Plans"      -> plan cards, view levels, pay with Razorpay
//   scene 4 "You're in"  -> plan active, confetti
// window.GMPPlans.reveal(ctx, scene)   night sky popup
// window.GMPPlans.section(host, ctx)   light plan section on the home page
// ctx = { plans, billing, user, pinterest, P (GMPGrowth.plan result), store, preview, onPaid(billing) }
(function () {
  if (window.GMPPlans) return;
  var R = "\u20B9";
  var RM = false;
  try { RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return R + Math.round(Number(n) || 0).toLocaleString("en-IN"); }
  function short(n) {
    n = Number(n) || 0;
    if (n >= 10000000) return (n / 10000000).toFixed(n % 10000000 ? 1 : 0) + "Cr";
    if (n >= 100000) return (n / 100000).toFixed(n % 100000 ? 1 : 0).replace(/\.0$/, "") + "L";
    if (n >= 1000) return Math.round(n / 1000) + "K";
    return String(n);
  }
  function first(ctx) { return ((ctx.user && ctx.user.name) || "").split(" ")[0] || ""; }
  function api(p, body) {
    var o = { credentials: "same-origin", headers: {} };
    if (body) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
    return fetch(p, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok && r.status !== 202) { var e = new Error(j.error || "Request failed (" + r.status + ")"); e.status = r.status; e.code = j.code; throw e; }
        j.__status = r.status;
        return j;
      });
    });
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; }
  }
  function waLink(num, text) { return "https://wa.me/" + String(num || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(text); }
  function sky(el) {
    if (!el) return;
    if (window.GMPSky) { window.GMPSky(el); return; }
    var n = 0, t = setInterval(function () { if (window.GMPSky || ++n > 20) { clearInterval(t); if (window.GMPSky && el.isConnected) window.GMPSky(el); } }, 250);
  }
  function countUp(el, to, ms, f) {
    if (!el) return;
    f = f || function (v) { return Math.round(v).toLocaleString("en-IN"); };
    if (RM || !to) { el.textContent = f(to || 0); return; }
    var t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function confetti() {
    if (RM) return;
    var c = document.createElement("canvas");
    c.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:400";
    document.body.appendChild(c);
    var x = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight, P = [];
    var cols = ["#14B88F", "#FFC75A", "#F29A2E", "#8C7CF0", "#FF7A93", "#7EF0CB"];
    for (var i = 0; i < 180; i++) P.push({ x: W / 2 + (Math.random() - .5) * 120, y: H / 2.6, vx: (Math.random() - .5) * 16, vy: Math.random() * -14 - 4, r: Math.random() * 7 + 3, c: cols[i % cols.length], a: Math.random() * 6 });
    var t0 = performance.now();
    (function fr(t) {
      x.clearRect(0, 0, W, H);
      P.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .34; p.vx *= .99; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
      if (t - t0 < 3200) requestAnimationFrame(fr); else c.remove();
    })(t0);
  }

  // ---------------- styles ----------------
  var css =
    // shared plan cards
    ".gpl-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}" +
    ".gpl-c{position:relative;text-align:left;font:inherit;cursor:pointer;border-radius:20px;padding:18px 14px 14px;background:#fff;border:2px solid #E7E9F0;color:#24292F;display:grid;gap:4px;align-content:start;transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s,box-shadow .25s;min-width:0}" +
    ".gpl-c:hover{transform:translateY(-3px);box-shadow:0 20px 40px -30px rgba(36,41,47,.55)}" +
    ".gpl-c.on{border-color:#0F9682;box-shadow:0 0 0 4px rgba(15,150,130,.16),0 24px 44px -30px rgba(15,150,130,.7)}" +
    ".gpl-c .tg{position:absolute;top:-11px;left:12px;font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:4px 9px;border-radius:999px;background:#24292F;color:#fff;white-space:nowrap}" +
    ".gpl-c.feat .tg{background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);color:#2A1503}" +
    ".gpl-c .nm{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:1rem;letter-spacing:-.01em}" +
    ".gpl-c .was{font-size:.86rem;color:#8A90A0;text-decoration:line-through;text-decoration-color:#E0405F;min-height:1.2em}" +
    ".gpl-c .pr{font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:clamp(1.45rem,3.4vw,1.85rem);letter-spacing:-.04em;line-height:1.05}" +
    ".gpl-c .pm{font-size:.8rem;color:#59606E;font-weight:600}" +
    ".gpl-c .sv{justify-self:start;margin-top:6px;font-size:.74rem;font-weight:800;color:#0B7A69;background:#E6F6F0;border-radius:999px;padding:3px 9px}" +
    ".gpl-c .sv.hot{color:#B4361A;background:#FFE9DC}" +
    ".gpl-c .rd{position:absolute;top:14px;right:12px;width:20px;height:20px;border-radius:50%;border:2px solid #D5D9E3;transition:all .25s}" +
    ".gpl-c.on .rd{border-color:#0F9682;background:#0F9682;box-shadow:inset 0 0 0 4px #fff}" +
    // view levels strip
    ".gpl-lv{border-radius:18px;padding:14px;background:#F7F8FB;border:1px solid #EEF0F5;display:grid;gap:10px}" +
    ".gpl-lv .hd{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}" +
    ".gpl-lv .hd b{font-family:Montserrat,system-ui,sans-serif;font-size:.95rem;color:#24292F}" +
    ".gpl-lv .hd span{font-size:.8rem;color:#59606E}" +
    ".gpl-steps{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;align-items:end}" +
    ".gpl-steps div{border-radius:12px;padding:8px 8px 7px;background:#fff;border:1px solid #E7E9F0;display:grid;gap:1px;position:relative;overflow:hidden}" +
    ".gpl-steps div::before{content:'';position:absolute;left:0;right:0;bottom:0;height:var(--h);background:linear-gradient(180deg,rgba(20,184,143,.06),rgba(20,184,143,.2));z-index:0}" +
    ".gpl-steps div>*{position:relative}" +
    ".gpl-steps small{font-size:.7rem;color:#59606E;font-weight:700}" +
    ".gpl-steps b{font-family:Montserrat,system-ui,sans-serif;font-size:.92rem;color:#24292F}" +
    ".gpl-steps em{font-style:normal;font-size:.76rem;color:#0B7A69;font-weight:800}" +
    ".gpl-trust{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:.8rem;color:#59606E;font-weight:600}" +
    ".gpl-trust span{display:inline-flex;align-items:center;gap:6px}" +
    ".gpl-trust i{width:16px;height:16px;border-radius:50%;background:#E6F6F0;display:grid;place-items:center;font-style:normal;color:#0B7A69;font-size:.66rem;font-weight:900}" +
    ".gpl-pay{border:0;cursor:pointer;font:inherit;font-weight:800;font-size:1.02rem;padding:15px 22px;border-radius:999px;color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);box-shadow:0 16px 32px -14px rgba(242,154,46,.95);display:inline-flex;align-items:center;justify-content:center;gap:10px;transition:transform .2s;text-decoration:none}" +
    ".gpl-pay:hover{transform:translateY(-2px)}.gpl-pay:disabled{opacity:.7;cursor:wait;transform:none}" +
    ".gpl-pay svg{width:18px;height:18px}" +
    ".gpl-err{font-size:.86rem;font-weight:700;color:#C02D52;min-height:1.1em}" +
    // home section (light)
    ".gpl-sec{position:relative;overflow:hidden;border-radius:26px;padding:clamp(18px,3vw,28px);background:radial-gradient(90% 120% at 100% 0%,#FFF4DE 0,rgba(255,244,222,0) 55%),radial-gradient(80% 120% at 0% 100%,#E6F6F0 0,rgba(230,246,240,0) 60%),#fff;border:1px solid #EEE3C9;display:grid;gap:16px;scroll-margin-top:80px}" +
    ".gpl-sec .top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}" +
    ".gpl-sec h2{margin:0;font-size:clamp(1.2rem,2.6vw,1.6rem)}" +
    ".gpl-sec .k{display:inline-flex;align-items:center;gap:7px;font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#B4601A}" +
    ".gpl-sec .k i{width:8px;height:8px;border-radius:50%;background:#F29A2E;animation:gplPing 1.6s infinite}" +
    ".gpl-cd{font-family:'DM Mono',ui-monospace,monospace;font-size:.86rem;font-weight:500;color:#7A3E0C;background:#FFF1DC;border:1px solid #F6D9A8;border-radius:12px;padding:7px 11px;white-space:nowrap}" +
    ".gpl-foot{display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:space-between}" +
    ".gpl-act{border-radius:20px;padding:16px 18px;background:linear-gradient(135deg,#09423D,#0F8A76 70%,#14B88F);color:#fff;display:flex;gap:14px;align-items:center;flex-wrap:wrap}" +
    ".gpl-act b{font-family:Montserrat,system-ui,sans-serif;font-size:1.12rem;display:block}" +
    ".gpl-act span{color:#D7F5EC;font-size:.92rem}" +
    ".gpl-act .bdg{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.15);display:grid;place-items:center;font-size:1.3rem;flex:none}" +
    ".gpl-prev{font-size:.78rem;font-weight:800;color:#5B4BC4;background:#EEEAFD;border-radius:999px;padding:4px 10px}" +
    // reveal popup (night sky)
    ".gpr-bg{position:fixed;inset:0;z-index:195;display:grid;place-items:center;padding:16px;overflow-y:auto;background:rgba(5,4,24,.66);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);animation:gplFade .35s ease}" +
    ".gpr{position:relative;width:min(540px,100%);margin:auto;border-radius:30px;padding:26px 22px 22px;color:#fff;font-family:Figtree,system-ui,sans-serif;overflow:hidden;transition:width .45s cubic-bezier(.2,.8,.2,1);" +
    "background:radial-gradient(70% 90% at 50% 120%,rgba(242,154,46,.42) 0,rgba(140,60,120,.18) 45%,transparent 70%),linear-gradient(170deg,#0E0B33 0%,#1E1557 50%,#3A1F73 100%);box-shadow:0 40px 90px -30px rgba(10,6,40,.9),inset 0 1px 0 rgba(255,255,255,.08)}" +
    ".gpr.wide{width:min(880px,100%)}" +
    ".gpr>*:not(.gmp-sky){position:relative;z-index:1}" +
    ".gpr .x{position:absolute;top:12px;right:12px;z-index:3;width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.1);color:#fff;font-size:1.4rem;line-height:1;cursor:pointer}" +
    ".gpr .dots{display:flex;gap:6px;margin-bottom:14px}" +
    ".gpr .dots i{width:8px;height:8px;border-radius:999px;background:rgba(255,255,255,.22);transition:all .35s}" +
    ".gpr .dots i.on{width:26px;background:#FFC75A}.gpr .dots i.done{background:#7EF0CB}" +
    ".gpr .sc{animation:gplIn .55s cubic-bezier(.2,.8,.2,1)}" +
    ".gpr .kk{font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#C9BEFF}" +
    ".gpr h2{margin:6px 0 4px;font-family:Montserrat,system-ui,sans-serif;font-size:clamp(1.45rem,5vw,2rem);line-height:1.12;letter-spacing:-.03em;color:#fff}" +
    ".gpr h2 em{font-style:normal;background:linear-gradient(180deg,#FFF3C4 10%,#FFC75A 55%,#F29A2E);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gpr p.l{color:#E2DCFF;font-size:.98rem;line-height:1.5;margin:0}" +
    ".gpr .seal{width:84px;height:84px;margin:4px auto 12px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#7EF0CB,#14B88F 60%,#0F8A76);box-shadow:0 0 0 10px rgba(126,240,203,.12),0 0 50px 8px rgba(20,184,143,.45);animation:gplPop .7s cubic-bezier(.2,1.6,.4,1)}" +
    ".gpr .seal svg{width:42px;height:42px;stroke:#062A25;stroke-width:3.4;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:40;stroke-dashoffset:40;animation:gplDraw .6s .35s ease forwards}" +
    ".gpr .ctr{text-align:center}" +
    ".gpr .st{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}" +
    ".gpr .st div{border-radius:18px;padding:14px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);display:grid;gap:2px}" +
    ".gpr .st b{font-family:Montserrat,system-ui,sans-serif;font-size:clamp(1.5rem,6vw,2rem);letter-spacing:-.03em;color:#fff}" +
    ".gpr .st small{font-size:.8rem;color:#CFC6FF}" +
    ".gpr .nums{font-family:Montserrat,system-ui,sans-serif;font-weight:800;letter-spacing:-.04em;line-height:1;margin:8px 0 2px;font-size:clamp(2.1rem,9vw,3.2rem);background:linear-gradient(180deg,#FFF3C4 10%,#FFC75A 55%,#F29A2E);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gpr .nums small{font-size:.4em;margin:0 8px;-webkit-text-fill-color:#CFC6FF}" +
    ".gpr .u{font-size:.86rem;color:#CFC6FF}" +
    ".gpr .ph{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}" +
    ".gpr .ph span{font-size:.8rem;font-weight:800;border-radius:999px;padding:5px 11px}" +
    ".gpr .ph .pa{background:rgba(242,165,74,.18);color:#FFC98A}.gpr .ph .rw{background:rgba(20,184,143,.2);color:#7EF0CB}" +
    ".gpr svg.rise{display:block;width:100%;height:140px;margin:8px 0 4px}" +
    ".gpr .go{margin-top:16px;width:100%}" +
    ".gpr .sec{display:block;margin:12px auto 0;background:none;border:0;color:#CFC6FF;font:inherit;font-weight:700;font-size:.88rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}" +
    ".gpr .fine{font-size:.74rem;color:#A99FE0;margin-top:10px;text-align:center}" +
    ".gpr .gpl-c{background:rgba(255,255,255,.96);border-color:transparent}" +
    ".gpr .gpl-c.on{border-color:#FFC75A;box-shadow:0 0 0 4px rgba(255,199,90,.25),0 26px 44px -26px rgba(0,0,0,.7)}" +
    ".gpr .gpl-c.on .rd{border-color:#F29A2E;background:#F29A2E}" +
    ".gpr .gpl-lv{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.12)}" +
    ".gpr .gpl-lv .hd b{color:#fff}.gpr .gpl-lv .hd span{color:#CFC6FF}" +
    ".gpr .gpl-steps div{background:rgba(255,255,255,.95);border-color:transparent}" +
    ".gpr .gpl-trust{color:#CFC6FF;justify-content:center}.gpr .gpl-trust i{background:rgba(126,240,203,.18);color:#7EF0CB}" +
    ".gpr .gpl-err{color:#FFB3C3;text-align:center}" +
    ".gpr .plan-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;padding-right:40px}" +
    ".gpr .gpl-cd{background:rgba(255,199,90,.12);border-color:rgba(255,199,90,.35);color:#FFE3A8}" +
    ".gpr .pv{display:inline-block;margin-left:8px;font-size:.7rem;font-weight:800;color:#2A1503;background:#C9BEFF;border-radius:999px;padding:2px 8px;vertical-align:middle;letter-spacing:.04em}" +
    "@keyframes gplFade{from{opacity:0}to{opacity:1}}" +
    "@keyframes gplIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
    "@keyframes gplPop{from{transform:scale(.3) rotate(-20deg);opacity:0}to{transform:none;opacity:1}}" +
    "@keyframes gplDraw{to{stroke-dashoffset:0}}" +
    "@keyframes gplPing{0%{box-shadow:0 0 0 0 rgba(242,154,46,.5)}70%,100%{box-shadow:0 0 0 8px rgba(242,154,46,0)}}" +
    "@media (max-width:760px){.gpl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gpr{padding:22px 16px 18px;border-radius:24px}}" +
    "@media (max-width:420px){.gpl-steps{grid-auto-flow:row;grid-template-columns:repeat(2,minmax(0,1fr))}.gpl-c{padding:16px 12px 12px}}" +
    "@media (prefers-reduced-motion:reduce){.gpr .sc,.gpr .seal,.gpr-bg{animation:none}.gpr .seal svg{animation:none;stroke-dashoffset:0}.gpl-sec .k i{animation:none}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';

  // ---------------- shared pieces ----------------
  function planCards(plans, sel) {
    return '<div class="gpl-grid" role="radiogroup" aria-label="Choose a plan">' + plans.items.map(function (p) {
      var feat = p.id === plans.featured;
      var tag = p.tag ? '<span class="tg">' + esc(p.tag) + '</span>' : "";
      var was = p.compare > p.price ? money(p.compare) : "";
      var pm = p.months > 1 ? money(p.per_month) + " / month" : "for 1 month";
      var chip = p.off_pct ? '<span class="sv hot">' + p.off_pct + '% off</span>' : (p.save ? '<span class="sv">Save ' + money(p.save) + '</span>' : "");
      return '<button type="button" role="radio" aria-checked="' + (p.id === sel) + '" class="gpl-c' + (p.id === sel ? " on" : "") + (feat ? " feat" : "") + '" data-plan="' + esc(p.id) + '">' +
        tag + '<span class="rd" aria-hidden="true"></span><span class="nm">' + esc(p.name) + '</span><span class="was">' + was + '</span>' +
        '<span class="pr">' + money(p.price) + '</span><span class="pm">' + pm + '</span>' + chip + '</button>';
    }).join("") + '</div>';
  }
  function levelsHtml(plans, current) {
    var lv = plans.levels || [];
    if (!lv.length) return "";
    var maxC = Math.max.apply(null, lv.map(function (l) { return l.charge; })) || 1;
    var cur = Number(current) || 0;
    return '<div class="gpl-lv"><div class="hd"><b>+ View levels: pay more only when you grow</b><span>' + esc(plans.note) + '</span></div>' +
      '<div class="gpl-steps">' + lv.map(function (l, i) {
        var next = lv[i + 1];
        var label = short(l.views) + "+ views";
        var here = cur >= l.views && (!next || cur < next.views);
        return '<div style="--h:' + Math.round(25 + 75 * l.charge / maxC) + '%"' + (here ? ' title="You are here"' : "") + '><small>' + label + (here ? " (you)" : "") + '</small><b>' + money(l.charge) + '</b><em>a month</em></div>';
      }).join("") + '</div></div>';
  }
  function trustHtml() {
    return '<div class="gpl-trust"><span><i>&#10003;</i>UPI, cards, netbanking via Razorpay</span><span><i>&#10003;</i>You approve every pin</span><span><i>&#10003;</i>Cancel any time</span></div>';
  }
  function findItem(plans, id) { return plans.items.filter(function (p) { return p.id === id; })[0] || plans.items[0]; }
  function payLabel(p) { return LOCK + "Pay " + money(p.price) + " securely"; }
  function countdown(el, iso) {
    if (!el || !iso) return;
    var end = new Date(iso).getTime();
    function tick() {
      if (!el.isConnected) return clearInterval(t);
      var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sc = s % 60;
      el.textContent = (d ? d + "d " : "") + String(h).padStart(2, "0") + "h " + String(m).padStart(2, "0") + "m " + String(sc).padStart(2, "0") + "s";
      if (!s) clearInterval(t);
    }
    var t = setInterval(tick, 1000);
    tick();
  }

  // ---------------- Razorpay ----------------
  var rzpLoading = null;
  function loadRzp() {
    if (window.Razorpay) return Promise.resolve();
    if (rzpLoading) return rzpLoading;
    rzpLoading = new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = function () { ok(); };
      s.onerror = function () { rzpLoading = null; bad(new Error("Could not open Razorpay. Check your internet and try again.")); };
      document.head.appendChild(s);
    });
    return rzpLoading;
  }
  function pollStatus(tries) {
    return api("/api/pay/status").then(function (r) {
      if (r.billing && r.billing.active) return r.billing;
      if (tries <= 0) return null;
      return new Promise(function (ok) { setTimeout(ok, 4000); }).then(function () { return pollStatus(tries - 1); });
    });
  }
  // opts: { onPaid(billing), onError(msg), onBusy(bool) }
  function pay(ctx, planId, opts) {
    var plans = ctx.plans;
    var item = findItem(plans, planId);
    opts.onBusy(true);
    return api("/api/pay/order", { plan_id: item.id }).then(function (o) {
      try { localStorage.setItem("gmp_pay_pending", o.order_id); } catch (e) {}
      return loadRzp().then(function () {
        var done = false;
        var rz = new window.Razorpay({
          key: o.key, amount: o.amount, currency: o.currency, order_id: o.order_id,
          name: o.name, description: o.description, image: o.image,
          prefill: o.prefill, notes: { plan: o.plan.name },
          theme: { color: "#0F8A76" },
          handler: function (resp) {
            done = true;
            opts.onBusy(true, "Confirming payment");
            api("/api/pay/verify", resp).then(function (v) {
              if (v.ok) return v.billing;
              return pollStatus(15);
            }).then(function (b) {
              if (b && b.active) {
                try { localStorage.removeItem("gmp_pay_pending"); } catch (e) {}
                opts.onPaid(b, o.plan);
              } else {
                opts.onBusy(false);
                opts.onError("Payment received by Razorpay but still processing. Refresh this page in a minute.");
              }
            }).catch(function (e) { opts.onBusy(false); opts.onError(e.message); });
          },
          modal: {
            ondismiss: function () {
              if (done) return;
              opts.onBusy(true, "Checking");
              // UPI apps sometimes finish after the window closes: check once
              setTimeout(function () {
                pollStatus(1).then(function (b) {
                  if (b && b.active) { opts.onPaid(b, o.plan); return; }
                  opts.onBusy(false);
                }).catch(function () { opts.onBusy(false); });
              }, 1500);
            }
          }
        });
        rz.on("payment.failed", function (r) {
          var m = (r && r.error && r.error.description) || "Payment failed.";
          opts.onError(m + " No money was taken. Try again or use another UPI app.");
        });
        rz.open();
        opts.onBusy(false);
      });
    }).catch(function (e) {
      opts.onBusy(false);
      if (e.code === "not_ready") opts.onError("__wa__" + e.message);
      else opts.onError(e.message);
    });
  }

  // ---------------- reveal popup ----------------
  function reveal(ctx, startScene) {
    var old = document.querySelector(".gpr-bg"); if (old) old.remove();
    var plans = ctx.plans, P = ctx.P, pin = ctx.pinterest || {};
    var paid = ctx.billing && ctx.billing.active;
    var bg = document.createElement("div");
    bg.className = "gpr-bg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    bg.setAttribute("aria-label", "Your GrowMyPin plan");
    bg.innerHTML = '<div class="gpr"><button class="x" type="button" aria-label="Close">&times;</button><div class="dots" aria-hidden="true"><i></i><i></i><i></i></div><div class="body"></div></div>';
    document.body.appendChild(bg);
    var box = bg.querySelector(".gpr"), body = bg.querySelector(".body");
    sky(box);
    var sel = plans ? plans.featured : "";
    function dots(n) {
      Array.prototype.forEach.call(bg.querySelectorAll(".dots i"), function (d, k) { d.className = k < n ? "done" : (k === n ? "on" : ""); });
      bg.querySelector(".dots").style.visibility = n > 2 ? "hidden" : "";
    }
    function close() { bg.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape" && !bg.classList.contains("busy")) close(); }
    document.addEventListener("keydown", onKey);
    bg.querySelector(".x").addEventListener("click", close);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });

    function scene1() {
      dots(0); box.classList.remove("wide");
      var who = pin.username ? "@" + esc(pin.username) : "Your account";
      var v = pin.views30, n = pin.pin_count;
      var lead = v == null ? "Your Pinterest numbers will show here." :
        (v < 1000 ? "A fresh start. That is perfect: Pinterest rewards accounts that post well from day one." :
          (v < 25000 ? "Good base. Pinterest already knows your account, so the right pins can grow it fast." : "Strong base. Now we turn these views into store visits."));
      body.innerHTML = '<div class="sc ctr"><div class="seal"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<div class="kk">Pinterest connected' + (ctx.preview ? '<span class="pv">PREVIEW</span>' : "") + '</div>' +
        '<h2>' + who + ' is <em>live</em> on GrowMyPin</h2>' +
        '<div class="st"><div><b data-n="v">0</b><small>views in the last 30 days</small></div><div><b data-n="p">0</b><small>pins on your account</small></div></div>' +
        '<p class="l">' + esc(lead) + '</p>' +
        '<button class="gpl-pay go" type="button" data-go="2">Show what my account can do</button></div>';
      countUp(body.querySelector('[data-n="v"]'), v || 0, 1500);
      countUp(body.querySelector('[data-n="p"]'), n || 0, 1200);
      if (!RM) setTimeout(confetti, 350);
    }
    function scene2() {
      dots(1); box.classList.remove("wide");
      var G = window.GMPGrowth;
      var hi = G ? G.total(P.best.views, 3) : 0;
      var m3 = P.best.views[3] || 0;
      var pat = P.best.patience || 2;
      body.innerHTML = '<div class="sc"><div class="kk">Your next 3 months</div>' +
        '<h2>' + (first(ctx) ? esc(first(ctx)) + ", your" : "Your") + ' account can <em>grow</em></h2>' +
        '<div class="nums"><span class="b">0</span></div>' +
        '<div class="u">total Pinterest views in 3 months</div>' +
        '<svg class="rise" role="img" aria-label="Pinterest views rising month by month"></svg>' +
        '<div class="ph"><span class="pa">Patience: month 1' + (pat > 2 ? " to " + (pat - 1) : "") + '</span><span class="rw">Reward: from month ' + pat + '</span></div>' +
        '<p class="l">Month 3 alone can bring about <b>' + Math.round(m3).toLocaleString("en-IN") + ' views</b> a month.</p>' +
        '<button class="gpl-pay go" type="button" data-go="3">' + (paid ? "Go to my pins" : "Unlock this growth") + '</button>' +
        '<div class="fine">' + esc(G ? G.DISCLAIMER : "This is an estimate, not a guarantee.") + '</div></div>';
      if (G) {
        G.countUp(body.querySelector(".b"), hi, 1700);
        G.drawRise(body.querySelector("svg.rise"), P.best.views, {});
      }
    }
    function scene3() {
      if (paid) { location.href = "/app.html"; return; }
      dots(2); box.classList.add("wide");
      var cur = findItem(plans, sel);
      body.innerHTML = '<div class="sc"><div class="plan-top"><div><div class="kk">' + (plans.offer_name ? esc(plans.offer_name) + " price" : "Choose your plan") + (ctx.preview ? '<span class="pv">PREVIEW</span>' : "") + '</div>' +
        '<h2>' + esc(plans.headline) + '</h2></div>' +
        (plans.offer_end ? '<div class="gpl-cd" aria-label="Offer ends in"><span class="cdv"></span> left</div>' : "") + '</div>' +
        planCards(plans, sel) +
        '<div style="height:14px"></div>' + levelsHtml(plans, pin.views30) +
        '<div style="display:grid;gap:10px;margin-top:16px;justify-items:center"><button class="gpl-pay" type="button" data-pay style="width:min(420px,100%)">' + payLabel(cur) + '</button>' +
        '<div class="gpl-err" role="alert"></div>' + trustHtml() +
        (plans.test_mode ? '<div class="fine">Razorpay TEST mode: no real money is taken.</div>' : "") + '</div></div>';
      countdown(body.querySelector(".cdv"), plans.offer_end);
    }
    function scene4(b, plan) {
      dots(3); box.classList.remove("wide");
      body.innerHTML = '<div class="sc ctr"><div class="seal"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<div class="kk">Payment successful</div>' +
        '<h2>You are in' + (first(ctx) ? ", <em>" + esc(first(ctx)) + "</em>" : "") + '!</h2>' +
        '<p class="l">Your <b>' + esc((plan && plan.name) || b.plan_name) + '</b> plan is active till <b>' + esc(fmtDate(b.plan_until)) + '</b>. A receipt is on its way to your email from Razorpay.</p>' +
        '<a class="gpl-pay go" href="/app.html">Approve my first pins</a>' +
        '<button class="sec" type="button" data-close>Back to my home</button></div>';
      confetti();
      setTimeout(confetti, 900);
    }
    function show(n) { ({ 1: scene1, 2: scene2, 3: scene3 })[n](); box.scrollIntoView({ block: "nearest" }); }

    body.addEventListener("click", function (e) {
      var go = e.target.closest("[data-go]");
      if (go) { show(Number(go.getAttribute("data-go"))); return; }
      if (e.target.closest("[data-close]")) { close(); return; }
      var c = e.target.closest("[data-plan]");
      if (c) {
        sel = c.getAttribute("data-plan");
        Array.prototype.forEach.call(body.querySelectorAll(".gpl-c"), function (x) { var on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        body.querySelector("[data-pay]").innerHTML = payLabel(findItem(plans, sel));
        body.querySelector(".gpl-err").textContent = "";
        return;
      }
      var pb = e.target.closest("[data-pay]");
      if (pb) {
        var err = body.querySelector(".gpl-err");
        err.textContent = "";
        pay(ctx, sel, {
          onBusy: function (b, label) { pb.disabled = !!b; bg.classList.toggle("busy", !!b); pb.innerHTML = b ? (label || "Opening Razorpay") : payLabel(findItem(plans, sel)); },
          onError: function (m) {
            if (m.indexOf("__wa__") === 0) {
              var item = findItem(plans, sel);
              err.innerHTML = esc(m.slice(6)) + (plans.whatsapp ? ' <a style="color:#7EF0CB" target="_blank" rel="noopener" href="' + esc(waLink(plans.whatsapp, "Hi GrowMyPin, I want the " + item.name + " plan (" + money(item.price) + ").")) + '">Chat on WhatsApp</a>' : "");
            } else err.textContent = m;
          },
          onPaid: function (b, plan) { ctx.billing = b; paid = true; scene4(b, plan); if (ctx.onPaid) ctx.onPaid(b); }
        });
      }
    });
    show(startScene || 1);
    return { close: close };
  }

  // ---------------- home page section (light mode) ----------------
  function section(host, ctx) {
    if (!host) return;
    var plans = ctx.plans, b = ctx.billing || {};
    if (!plans) { host.innerHTML = ""; host.hidden = true; return; }
    host.hidden = false;
    var sel = plans.featured;
    var active = b.active ? '<div class="gpl-act"><span class="bdg" aria-hidden="true">&#10003;</span><div style="flex:1;min-width:200px"><b>Your ' + esc(b.plan_name) + ' plan is active</b><span>Till ' + esc(fmtDate(b.plan_until)) + ' (' + b.days_left + ' day' + (b.days_left === 1 ? "" : "s") + ' left). Want more time? Add a plan below and it starts after this one.</span></div><a class="btn btn-gold" href="/app.html">Open Pin Studio</a></div>' : "";
    host.innerHTML = '<div class="gpl-sec">' +
      '<div class="top"><div><div class="k"><i></i>' + (plans.offer_name ? esc(plans.offer_name) + " price is on" : "Plans") + (ctx.preview ? ' <span class="gpl-prev">Admin preview</span>' : "") + '</div><h2 style="margin-top:6px">' + esc(b.active ? "Add more months" : plans.headline) + '</h2>' +
      '<p class="h-muted" style="margin-top:4px">' + (b.active ? "Keep the growth going. A new plan starts the day your current one ends." : "Your Pinterest is connected. Pick a plan and we start growing it.") + '</p></div>' +
      (plans.offer_end ? '<div class="gpl-cd"><span class="cdv"></span> left</div>' : "") + '</div>' +
      active + planCards(plans, sel) + levelsHtml(plans, (ctx.pinterest || {}).views30) +
      '<div class="gpl-foot">' + trustHtml() + '<div style="display:grid;gap:6px;justify-items:end"><button class="gpl-pay" type="button" data-pay>' + payLabel(findItem(plans, sel)) + '</button><div class="gpl-err" role="alert"></div></div></div>' +
      (plans.test_mode ? '<p class="h-muted" style="font-size:.78rem">Razorpay TEST mode: no real money is taken.</p>' : "") +
      '</div>';
    countdown(host.querySelector(".cdv"), plans.offer_end);
    host.onclick = function (e) {
      var c = e.target.closest("[data-plan]");
      var pb = host.querySelector("[data-pay]");
      var err = host.querySelector(".gpl-err");
      if (c) {
        sel = c.getAttribute("data-plan");
        Array.prototype.forEach.call(host.querySelectorAll(".gpl-c"), function (x) { var on = x === c; x.classList.toggle("on", on); x.setAttribute("aria-checked", String(on)); });
        pb.innerHTML = payLabel(findItem(plans, sel));
        err.textContent = "";
        return;
      }
      if (e.target.closest("[data-pay]")) {
        err.textContent = "";
        pay(ctx, sel, {
          onBusy: function (bz, label) { pb.disabled = !!bz; pb.innerHTML = bz ? (label || "Opening Razorpay") : payLabel(findItem(plans, sel)); },
          onError: function (m) {
            if (m.indexOf("__wa__") === 0) {
              var item = findItem(plans, sel);
              err.innerHTML = esc(m.slice(6)) + (plans.whatsapp ? ' <a target="_blank" rel="noopener" href="' + esc(waLink(plans.whatsapp, "Hi GrowMyPin, I want the " + item.name + " plan (" + money(item.price) + ").")) + '">Chat on WhatsApp</a>' : "");
            } else err.textContent = m;
          },
          onPaid: function (bl, plan) {
            ctx.billing = bl;
            if (ctx.onPaid) ctx.onPaid(bl);
            showSuccess(ctx, bl, plan); // celebrate in the night sky popup
          }
        });
      }
    };
  }
  function showSuccess(ctx, b, plan) {
    var old = document.querySelector(".gpr-bg"); if (old) old.remove();
    var bg = document.createElement("div");
    bg.className = "gpr-bg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    bg.innerHTML = '<div class="gpr"><button class="x" type="button" aria-label="Close">&times;</button><div class="sc ctr"><div class="seal"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<div class="kk">Payment successful</div><h2>You are in' + (first(ctx) ? ", <em>" + esc(first(ctx)) + "</em>" : "") + '!</h2>' +
      '<p class="l">Your <b>' + esc((plan && plan.name) || b.plan_name) + '</b> plan is active till <b>' + esc(fmtDate(b.plan_until)) + '</b>. A receipt is on its way to your email from Razorpay.</p>' +
      '<a class="gpl-pay go" href="/app.html">Approve my first pins</a><button class="sec" type="button" data-close>Back to my home</button></div></div>';
    document.body.appendChild(bg);
    sky(bg.querySelector(".gpr"));
    function close() { bg.remove(); }
    bg.querySelector(".x").onclick = close;
    bg.querySelector("[data-close]").onclick = close;
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    confetti(); setTimeout(confetti, 900);
  }

  window.GMPPlans = { reveal: reveal, section: section, success: showSuccess, money: money };
})();
