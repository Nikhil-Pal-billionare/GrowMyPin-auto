// GrowMyPin shared page script (include on every page with: <script src="/gmp.js" defer></script>)
//  1. counts visits for the admin panel (visitors, sessions, bounce rate)
//  2. shows messages you send from the admin panel as a popup
//  3. shows the Admin link only to admins
//  4. lets people turn on phone notifications (window.GMPPush.enable())
//  5. offer ribbon (texts + on/off from Admin > Settings)
//  6. "Your Pinterest views can reach ..." popup after X minutes on the site per day (Admin > Settings)
(function () {
  var path = location.pathname || "/";
  var isSignup = /^\/signup(\.html)?$/.test(path);
  var isHome = /^\/home(\.html)?$/.test(path);
  var isAdminPage = /^\/admin/.test(path);

  // ---------------- 1. visit counter ----------------
  function rid() {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var vid = "", sid = "";
  try {
    vid = localStorage.getItem("gmp_vid") || "";
    if (!vid) { vid = rid(); localStorage.setItem("gmp_vid", vid); }
    var s = JSON.parse(sessionStorage.getItem("gmp_sid") || localStorage.getItem("gmp_sid") || "null");
    if (s && s.id && Date.now() - s.t < 30 * 60 * 1000) sid = s.id;
    if (!sid) sid = rid();
    var stamp = JSON.stringify({ id: sid, t: Date.now() });
    localStorage.setItem("gmp_sid", stamp);
  } catch (e) {
    vid = vid || rid(); sid = sid || rid();
  }
  function touch() { try { localStorage.setItem("gmp_sid", JSON.stringify({ id: sid, t: Date.now() })); } catch (e) {} }

  // signals that help the server tell real people from bots (no personal data)
  var staff = false;
  try { staff = isAdminPage || localStorage.getItem("gmp_staff") === "1"; if (isAdminPage) localStorage.setItem("gmp_staff", "1"); } catch (e) {}
  function signals() {
    var o = {};
    try { o.wd = navigator.webdriver === true; } catch (e) {}
    try { o.sw = screen.width || 0; o.sh = screen.height || 0; } catch (e) {}
    try { o.lang = (navigator.languages || []).length; } catch (e) {}
    try { o.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    if (staff) o.staff = true;
    return o;
  }
  function send(kind) {
    var data = { vid: vid, sid: sid, kind: kind, path: path, ref: document.referrer || "" };
    var sg = signals();
    for (var k in sg) data[k] = sg[k];
    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return;
    } catch (e) {}
    try { fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true, credentials: "same-origin" }); } catch (e) {}
  }
  send("view");

  // engaged visit = 10 seconds on the page while visible, or any click / key press
  var engaged = false, seen = 0, last = Date.now();
  function engage() { if (engaged) return; engaged = true; send("engage"); touch(); }
  var engTimer = setInterval(function () {
    if (document.visibilityState === "visible") seen += Date.now() - last;
    last = Date.now();
    if (seen >= 10000) { clearInterval(engTimer); engage(); }
  }, 1000);
  ["pointerdown", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, function once() { document.removeEventListener(ev, once, true); setTimeout(engage, 400); }, true);
  });
  document.addEventListener("visibilitychange", touch);

  // real person = real mouse movement, scroll, tap or key press (bots almost never do these)
  var human = false, moves = 0;
  function isHuman(e) {
    if (human || (e && e.isTrusted === false)) return;
    if (e && e.type === "mousemove") { moves++; if (moves < 4) return; }
    human = true;
    send("human");
    ["mousemove", "touchstart", "wheel", "scroll", "keydown"].forEach(function (ev) { window.removeEventListener(ev, isHuman, true); });
  }
  ["mousemove", "touchstart", "wheel", "scroll", "keydown"].forEach(function (ev) { window.addEventListener(ev, isHuman, { capture: true, passive: true }); });

  // ---------------- helpers ----------------
  function css(txt) {
    var st = document.createElement("style");
    st.textContent = txt;
    document.head.appendChild(st);
  }
  function api(p, body) {
    var o = { credentials: "same-origin", headers: {} };
    if (body) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
    return fetch(p, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "Request failed"); return j; }); });
  }

  css(
    ".gmp-msg-bg{position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:16px;background:rgba(6,24,21,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:gmpFade .3s ease}" +
    ".gmp-msg{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:26px;background:#fff;color:#1F242B;box-shadow:0 40px 80px -30px rgba(0,0,0,.6);animation:gmpPop .55s cubic-bezier(.2,1.3,.3,1);font-family:Figtree,system-ui,sans-serif}" +
    ".gmp-msg img{display:block;width:100%;max-height:60vh;object-fit:cover;border-radius:26px 26px 0 0;background:#F1EEFB}" +
    ".gmp-msg .in{padding:22px 22px 20px;display:grid;gap:12px}" +
    ".gmp-msg .from{display:flex;align-items:center;gap:10px;font-size:.85rem;color:#59606E;font-weight:600}" +
    ".gmp-msg .from i{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#09423D,#0F8A76 55%,#14B88F);display:grid;place-items:center;color:#fff;font-style:normal;font-weight:800;font-size:.8rem}" +
    ".gmp-msg h3{margin:0;font-family:Montserrat,system-ui,sans-serif;font-size:1.25rem;letter-spacing:-.02em;color:#24292F}" +
    ".gmp-msg p{margin:0;white-space:pre-wrap;line-height:1.55;font-size:1rem}" +
    ".gmp-msg .row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:4px}" +
    ".gmp-msg .n{font-size:.8rem;color:#8A90A0}" +
    ".gmp-msg button{border:0;border-radius:999px;padding:12px 22px;font:inherit;font-weight:700;color:#fff;background:linear-gradient(135deg,#09423D,#0F8A76 55%,#14B88F);cursor:pointer}" +
    ".gmp-admin-link{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;background:#24292F;color:#fff !important;text-decoration:none;font-weight:700;font-size:.85rem;margin-right:8px}" +
    ".gmp-ribbon{position:fixed;left:50%;bottom:16px;z-index:60;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:10px 10px 10px 18px;border-radius:999px;background:#061815;color:#fff;box-shadow:0 18px 40px -16px rgba(0,0,0,.6);font-family:Figtree,system-ui,sans-serif;font-weight:600;font-size:.92rem;width:max-content;max-width:calc(100% - 32px);animation:gmpUp .6s cubic-bezier(.2,.8,.2,1)}" +
    ".gmp-ribbon a{white-space:nowrap;text-decoration:none;color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);padding:9px 16px;border-radius:999px;font-weight:800}" +
    ".gmp-ribbon button{background:none;border:0;color:#9DB3AE;font-size:1.2rem;line-height:1;cursor:pointer;padding:4px 6px}" +
    ".gmp-ribbon .d{width:9px;height:9px;border-radius:50%;background:#FFC75A;box-shadow:0 0 12px #FFC75A;flex:none}" +
    "@keyframes gmpFade{from{opacity:0}}@keyframes gmpPop{from{opacity:0;transform:translateY(30px) scale(.92)}}@keyframes gmpUp{from{opacity:0;transform:translate(-50%,30px)}}" +
    "@media (prefers-reduced-motion:reduce){.gmp-msg-bg,.gmp-msg,.gmp-ribbon{animation:none}}" +
    "@media (max-width:520px){.gmp-ribbon{font-size:.84rem;gap:8px;padding-left:14px}}"
  );

  // ---------------- 2. message popup ----------------
  var queue = [], open = false;
  function showNext() {
    if (open || !queue.length) return;
    open = true;
    var m = queue.shift();
    var bg = document.createElement("div");
    bg.className = "gmp-msg-bg";
    bg.setAttribute("role", "dialog");
    bg.setAttribute("aria-modal", "true");
    var box = document.createElement("div");
    box.className = "gmp-msg";
    if (m.image_url) {
      var img = document.createElement("img");
      img.src = m.image_url; img.alt = "";
      box.appendChild(img);
    }
    var inn = document.createElement("div");
    inn.className = "in";
    var from = document.createElement("div");
    from.className = "from";
    from.innerHTML = "<i>G</i>";
    var fs = document.createElement("span");
    var when = new Date(m.created_at);
    fs.textContent = "GrowMyPin, " + when.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    from.appendChild(fs);
    inn.appendChild(from);
    if (m.title && m.title !== "Message from GrowMyPin") {
      var h = document.createElement("h3"); h.textContent = m.title; inn.appendChild(h);
    }
    if (m.body) { var p = document.createElement("p"); p.textContent = m.body; inn.appendChild(p); }
    var row = document.createElement("div");
    row.className = "row";
    var n = document.createElement("span");
    n.className = "n";
    n.textContent = queue.length ? (queue.length + " more") : "";
    var ok = document.createElement("button");
    ok.type = "button";
    ok.textContent = queue.length ? "Next" : "Got it";
    row.appendChild(n); row.appendChild(ok);
    inn.appendChild(row);
    box.appendChild(inn);
    bg.appendChild(box);
    document.body.appendChild(bg);
    setTimeout(function () { ok.focus(); }, 60);
    function close() {
      bg.remove();
      open = false;
      document.removeEventListener("keydown", onKey);
      showNext();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    ok.addEventListener("click", close);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    document.addEventListener("keydown", onKey);
    if (!m.seen_at) api("/api/user/hub", { action: "seen", ids: [m.id] }).catch(function () {});
  }

  // ---------------- 4. push notifications ----------------
  var vapid = "";
  function b64ToUint8(b64) {
    var pad = "=".repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }

  async function subscribe(ask) {
    if (!pushSupported() || !vapid) return { ok: false, message: "Notifications are not available in this browser." };
    var reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    var perm = Notification.permission;
    if (perm === "default" && ask) perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, message: perm === "denied" ? "Notifications are blocked. Allow them for this site in your browser settings." : "Notifications are still off." };
    var sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapid) });
    await api("/api/user/hub", { action: "push", subscription: sub.toJSON() });
    return { ok: true, message: "Done. Slot updates will come to this device." };
  }

  window.GMPPush = {
    enable: async function () {
      try {
        if (isIOS() && !standalone()) {
          return { ok: false, message: "On iPhone: tap Share, then Add to Home Screen, open GrowMyPin from there and tap this again." };
        }
        if (!vapid) {
          var me = await api("/api/user/me?lite=1");
          vapid = me.vapid || "";
        }
        return await subscribe(true);
      } catch (e) {
        return { ok: false, message: "Could not turn on notifications: " + (e.message || e) };
      }
    }
  };

  // Notification clicked while the site is open: show that message now.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (e) {
      if (e.data && e.data.type === "gmp-open" && e.data.url) {
        var id = (String(e.data.url).match(/msg=([0-9a-f-]+)/i) || [])[1];
        if (id) loadMe(id);
      }
    });
  }

  // ---------------- 3 + 5. who is this? ----------------
  function addAdminLink() {
    if (document.querySelector(".gmp-admin-link")) return;
    var host = document.getElementById("acctArea") || document.querySelector(".nav .wrap");
    if (!host) return;
    var a = document.createElement("a");
    a.className = "gmp-admin-link";
    a.href = "/admin";
    a.textContent = "Admin";
    if (host.id === "acctArea") host.insertBefore(a, host.firstChild);
    else {
      var last = host.lastElementChild;
      host.insertBefore(a, last);
    }
  }

  var SET = {};
  function tpl(t, extra) {
    var out = String(t || "").replace(/\{offer\}/g, SET.offer_name || "").replace(/\{percent\}/g, SET.offer_percent || "");
    if (extra) for (var k in extra) out = out.split("{" + k + "}").join(extra[k]);
    return out.replace(/\{first\},?\s*/g, "");
  }

  function ribbon(loggedIn) {
    if (!SET.ribbon_enabled || !SET.offer_active || isSignup || isHome || isAdminPage) return;
    try { if (sessionStorage.getItem("gmp_ribbon_off")) return; } catch (e) {}
    var r = document.createElement("div");
    r.className = "gmp-ribbon";
    var d = document.createElement("span"); d.className = "d"; d.setAttribute("aria-hidden", "true");
    var t = document.createElement("span"); t.textContent = tpl(SET.ribbon_text);
    var a = document.createElement("a"); a.href = loggedIn ? "/signup.html#offer" : "/signup.html"; a.textContent = SET.ribbon_btn || "Reserve my slot";
    var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Hide"); x.innerHTML = "&times;";
    x.addEventListener("click", function () {
      r.remove();
      try { sessionStorage.setItem("gmp_ribbon_off", "1"); } catch (e) {}
    });
    r.appendChild(d); r.appendChild(t); r.appendChild(a); r.appendChild(x);
    document.body.appendChild(r);
    var sticky = document.getElementById("stickyCta");
    if (sticky) r.style.bottom = "84px";
  }

  // ---------------- 6. visits popup ----------------
  function istDay() { return new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); }
  function loadGrowth(cb) {
    if (window.GMPGrowth) return cb();
    var sc = document.createElement("script");
    sc.src = "/gmp-growth.js";
    sc.onload = cb;
    document.head.appendChild(sc);
  }
  css(
    ".gmp-vp-bg{position:fixed;inset:0;z-index:190;display:grid;place-items:center;padding:16px;overflow-y:auto;background:rgba(3,12,11,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:gmpFade .35s ease}" +
    ".gmp-vp{position:relative;width:min(520px,100%);margin:auto;border-radius:28px;padding:26px 22px 22px;color:#fff;font-family:Figtree,system-ui,sans-serif;overflow:hidden;" +
    "background:radial-gradient(120% 55% at 50% 118%,rgba(242,154,46,.45) 0,rgba(140,60,120,.25) 35%,transparent 65%),linear-gradient(180deg,#0E0B33 0%,#1E1557 40%,#33206E 75%,#4A2670 100%);box-shadow:0 50px 90px -30px rgba(10,6,40,.8);animation:gmpPop .6s cubic-bezier(.2,1.2,.3,1)}" +
    ".gmp-vp>*:not(.gmp-sky):not(.x){position:relative;z-index:1}.gmp-vp .x{z-index:2}" +
    ".gmp-vp .k{font-size:.92rem;color:#D8CFFF;font-weight:600}" +
    ".gmp-vp .nums{font-family:Montserrat,system-ui,sans-serif;font-weight:800;letter-spacing:-.04em;line-height:1;margin:6px 0 4px;font-size:clamp(2.2rem,9vw,3.3rem);background:linear-gradient(180deg,#FFF3C4 10%,#FFC75A 55%,#F29A2E);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gmp-vp .nums small{font-size:.45em;letter-spacing:0;vertical-align:.35em;margin:0 .25em;-webkit-text-fill-color:#D8CFFF}" +
    ".gmp-vp .u{font-size:.9rem;color:#E6E0FF}" +
    ".gmp-vp .u2{margin-top:8px;font-size:.92rem;font-weight:700;color:#7EF0CB}" +
    ".gmp-vp h3{margin:18px 0 6px;font-family:Montserrat,system-ui,sans-serif;font-size:1.35rem;letter-spacing:-.02em;color:#fff}" +
    ".gmp-vp svg{display:block;width:100%;height:auto;margin:4px 0 6px;overflow:visible}" +
    ".gmp-vp .note{font-size:.76rem;color:#B9AEE6;margin-bottom:16px}" +
    ".gmp-vp .acts{display:grid;gap:8px;justify-items:center}" +
    ".gmp-vp .yes{width:100%;border:0;border-radius:999px;padding:16px 20px;font:inherit;font-weight:800;font-size:1.05rem;color:#2A1503;cursor:pointer;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);box-shadow:0 18px 40px -14px rgba(242,154,46,.8)}" +
    ".gmp-vp .no{border:0;background:none;color:#CFC6F5;font:inherit;font-weight:600;padding:8px 14px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}" +
    ".gmp-vp .x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:1.2rem;cursor:pointer}" +
    ".gmp-vp .done{text-align:center;display:grid;gap:12px;justify-items:center;padding:12px 0 4px}" +
    ".gmp-vp .done b{font-family:Montserrat,system-ui,sans-serif;font-size:1.4rem}" +
    ".gmp-vp .done a{display:inline-flex;padding:13px 22px;border-radius:999px;background:#25D366;color:#06301A;text-decoration:none;font-weight:800}" +
    ".gmp-vp .chk{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(52,214,168,.15);color:#34D6A8;font-size:2rem;animation:gmpPop .5s cubic-bezier(.2,1.6,.3,1)}"
  );

  // ---------------- Diwali night sky (used by popups: window.GMPSky(element)) ----------------
  css(
    ".gmp-sky i{display:block;font-style:normal}.gmp-sky{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;z-index:0}" +
    ".gmp-sky .gsk-s{position:absolute;border-radius:50%;background:#fff;opacity:.2;animation:gmpTw var(--d) ease-in-out infinite alternate;animation-delay:var(--dl)}" +
    ".gmp-sky .gsk-m{position:absolute;top:16px;right:74px;width:30px;height:30px;border-radius:50%;box-shadow:7px -4px 0 0 #FFE9B0;transform:rotate(-20deg);filter:drop-shadow(0 0 10px rgba(255,225,150,.7));opacity:.95}" +
    ".gmp-sky .gsk-l{position:absolute;bottom:-50px;width:var(--w);height:calc(var(--w) * 1.35);border-radius:42% 42% 30% 30%;background:radial-gradient(circle at 50% 62%,#FFF6D2 0,#FFC75A 38%,#F07A2A 82%);box-shadow:0 0 18px 6px rgba(255,170,70,.4);opacity:0;animation:gmpLan var(--t) linear infinite;animation-delay:var(--dl)}" +
    ".gmp-sky .gsk-l::after{content:'';position:absolute;left:50%;bottom:-5px;width:40%;height:5px;margin-left:-20%;border-radius:0 0 4px 4px;background:#8A3A12}" +
    ".gmp-sky canvas{position:absolute;inset:0;width:100%;height:100%}" +
    "@keyframes gmpTw{from{opacity:.15}to{opacity:.95}}" +
    "@keyframes gmpLan{0%{transform:translate(0,0);opacity:0}8%{opacity:.6}50%{transform:translate(16px,-300px)}85%{opacity:.45}100%{transform:translate(-8px,-640px);opacity:0}}" +
    "@media (prefers-reduced-motion:reduce){.gmp-sky .gsk-s,.gmp-sky .gsk-l{animation:none}.gmp-sky .gsk-l{display:none}}"
  );
  function GMPSky(host) {
    if (!host || host.querySelector(":scope > .gmp-sky")) return;
    var reduceM = false;
    try { reduceM = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    var s = document.createElement("div");
    s.className = "gmp-sky";
    s.setAttribute("aria-hidden", "true");
    var h = '<i class="gsk-m"></i>';
    for (var i = 0; i < 55; i++) {
      var z = (Math.random() * 1.8 + .8).toFixed(1);
      h += '<i class="gsk-s" style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 62).toFixed(1) + '%;width:' + z + 'px;height:' + z + 'px;--d:' + (1.4 + Math.random() * 2.6).toFixed(1) + 's;--dl:-' + (Math.random() * 3).toFixed(1) + 's"></i>';
    }
    for (var j = 0; j < 7; j++) {
      h += '<i class="gsk-l" style="left:' + (6 + j * 13 + Math.random() * 6).toFixed(1) + '%;--w:' + (9 + Math.random() * 9).toFixed(0) + 'px;--t:' + (11 + Math.random() * 8).toFixed(1) + 's;--dl:-' + (Math.random() * 14).toFixed(1) + 's"></i>';
    }
    s.innerHTML = h + "<canvas></canvas>";
    host.insertBefore(s, host.firstChild);
    if (reduceM) return;
    // small firework bursts high in the sky
    var cv = s.querySelector("canvas"), ctx = cv.getContext("2d"), parts = [], next = 600, last = 0;
    var COLS = ["#FFD36B", "#FF8FB1", "#7EF0CB", "#B9A4FF", "#FFB25C"];
    function size() { var r = s.getBoundingClientRect(); var d = Math.min(2, window.devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); return r; }
    var box = size();
    function burst() {
      var x = box.width * (.15 + Math.random() * .7), y = box.height * (.06 + Math.random() * .22), c = COLS[Math.floor(Math.random() * COLS.length)];
      for (var k = 0; k < 30; k++) {
        var a = Math.PI * 2 * k / 30, v = 1.1 + Math.random() * 1.3;
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: c });
      }
    }
    function frame(t) {
      if (!s.isConnected) return;
      if (!last) last = t;
      var dt = Math.min(50, t - last); last = t;
      next -= dt;
      if (next <= 0) { burst(); next = 1600 + Math.random() * 1800; }
      ctx.clearRect(0, 0, box.width, box.height);
      for (var k = parts.length - 1; k >= 0; k--) {
        var p = parts[k];
        p.x += p.vx; p.y += p.vy; p.vy += .025; p.vx *= .985; p.vy *= .985; p.life -= .014;
        if (p.life <= 0) { parts.splice(k, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life) * .7;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    window.addEventListener("resize", function () { if (s.isConnected) box = size(); });
  }
  window.GMPSky = GMPSky;

  var ME = null, popTimer = null;
  function startPopupClock(force) {
    if (!ME || !ME.user || !SET.popup_enabled || isSignup || isAdminPage) return;
    var day = istDay(), keyT = "gmp_act_" + day, keyS = "gmp_vpop_" + day;
    var need = Math.max(30, Math.round((Number(SET.popup_minutes) || 2) * 60));
    if (force) { showVisitsPopup(); return; }
    try { if (localStorage.getItem(keyS)) return; } catch (e) { return; }
    clearInterval(popTimer);
    popTimer = setInterval(function () {
      if (document.visibilityState !== "visible") return;
      var t = 0;
      try { t = (Number(localStorage.getItem(keyT)) || 0) + 5; localStorage.setItem(keyT, String(t)); } catch (e) { return; }
      if (t >= need && !open && !document.querySelector(".gmp-vp-bg")) {
        clearInterval(popTimer);
        try { if (localStorage.getItem(keyS)) return; localStorage.setItem(keyS, "1"); } catch (e) {}
        showVisitsPopup();
      }
    }, 5000);
  }

  function showVisitsPopup() {
    loadGrowth(function () {
      var GR = window.GMPGrowth;
      var g = (ME && ME.growth) || {};
      var p = GR.pickPlatform(g.platforms || []);
      var store = p ? GR.NAMES[p] : "online";
      var ps = g.pin_stats || {};
      GR.setConfig(SET.growth);
      var P = GR.plan({ niche: g.niche || "", platform: p || "etsy", current: ps.views30 || 0 });
      var bg = document.createElement("div");
      bg.className = "gmp-vp-bg";
      bg.setAttribute("role", "dialog");
      bg.setAttribute("aria-modal", "true");
      bg.innerHTML =
        '<div class="gmp-vp">' +
        '<button class="x" type="button" aria-label="Close">&times;</button>' +
        '<div class="k">Your Pinterest views can reach</div>' +
        '<div class="nums"><span class="b">0</span></div>' +
        '<div class="u">total Pinterest views in the next 6 months</div>' +
        '<div class="u2"></div>' +
        '<h3></h3>' +
        '<svg role="img" aria-label="Your Pinterest views rising over 6 months"></svg>' +
        '<div class="note"></div>' +
        '<div class="acts"><button class="yes" type="button"></button><button class="no" type="button"></button></div>' +
        '</div>';
      bg.querySelector("h3").textContent = tpl(SET.popup_title || "Increase your {store} store visits", { store: store });
      bg.querySelector(".yes").textContent = SET.popup_yes_btn || "I want to increase visits";
      bg.querySelector(".no").textContent = SET.popup_no_btn || "I'll do later";
      document.body.appendChild(bg);
      GMPSky(bg.querySelector(".gmp-vp"));
      GR.countUp(bg.querySelector(".b"), GR.total(P.best.views, 6), 1800);
      bg.querySelector(".u2").textContent = "That is about " + GR.fmt(P.best.views[6]) + " views a month by month 6.";
      bg.querySelector(".note").textContent = GR.DISCLAIMER;
      GR.drawRise(bg.querySelector("svg"), P.best.views, {});
      function close() { bg.remove(); document.removeEventListener("keydown", onKey); }
      function onKey(e) { if (e.key === "Escape") close(); }
      document.addEventListener("keydown", onKey);
      bg.querySelector(".x").addEventListener("click", close);
      bg.querySelector(".no").addEventListener("click", close);
      bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
      bg.querySelector(".yes").addEventListener("click", function () {
        var btn = this;
        btn.disabled = true;
        btn.textContent = "Saving";
        api("/api/user/hub", { action: "interest", source: "popup" }).then(function (r) {
          var box = bg.querySelector(".gmp-vp");
          var wa = (r && r.whatsapp) || SET.sales_whatsapp || "";
          box.innerHTML = '<button class="x" type="button" aria-label="Close">&times;</button><div class="done"><div class="chk">&#10003;</div><b>Great, you are on the list</b><span class="u">Our team will message you on WhatsApp within 24 hours with a plan to grow your ' + store + ' store visits.</span></div>';
          if (wa) {
            var a = document.createElement("a");
            a.href = "https://wa.me/" + wa.replace(/\D/g, "") + "?text=" + encodeURIComponent("Hi GrowMyPin, I want to increase my " + store + " store visits.");
            a.target = "_blank"; a.rel = "noopener";
            a.textContent = "Chat now on WhatsApp";
            box.querySelector(".done").appendChild(a);
          }
          box.querySelector(".x").addEventListener("click", close);
          GMPSky(box);
        }).catch(function () { btn.disabled = false; btn.textContent = "Try again"; });
      });
    });
  }

  // Vercel preview links (growmypin-auto-abc123-xyz.vercel.app) keep their own login, so people
  // were asked to log in again. Send them to the main site address (SITE_URL in Vercel).
  function mainHost(site) {
    var h = location.hostname, main = String(site || "").toLowerCase();
    if (!main || main === location.host || !/\.vercel\.app$/.test(h)) return false;
    var preview = /-git-/.test(h) || /^[a-z0-9-]+-[a-z0-9]{8,}-[a-z0-9-]+\.vercel\.app$/.test(h);
    if (!preview) return false;
    location.replace("https://" + main + location.pathname + location.search + location.hash);
    return true;
  }

  function loadMe(msgId) {
    var q = "/api/user/me?lite=1" + (msgId ? "&msg=" + encodeURIComponent(msgId) : "");
    return api(q).then(function (me) {
      if (!me) return;
      if (me.settings && mainHost(me.settings.site_host)) return;
      SET = me.settings || {};
      window.GMPSettings = SET;
      if (!me.user) { ribbon(false); return; }
      ME = me;
      window.GMPMe = me;
      vapid = me.vapid || "";
      if (me.is_admin) { addAdminLink(); try { localStorage.setItem("gmp_staff", "1"); } catch (e) {} }
      loadNav();
      var list = (me.messages || []).slice().reverse(); // oldest first
      if (msgId) list.sort(function (a, b) { return a.id === msgId ? -1 : (b.id === msgId ? 1 : 0); });
      list.forEach(function (m) {
        if (!queue.some(function (x) { return x.id === m.id; })) queue.push(m);
      });
      showNext();
      if (!msgId && (me.offer === "pending" || me.offer === "regret")) ribbon(true);
      startPopupClock(/[?&]gmp_popup=1/.test(location.search));
      // keep the notification subscription fresh if already allowed
      if (pushSupported() && vapid && Notification.permission === "granted") subscribe(false).catch(function () {});
    }).catch(function () {});
  }
  window.GMPShowVisitsPopup = function () { showVisitsPopup(); };

  // bottom menu bar (Home, Search, Performance, Profile, More) for logged-in people: /gmp-nav.js
  function loadNav() {
    if (isSignup || isAdminPage || /^\/(reset|404)(\.html)?$/.test(path) || window.GMPNav) return;
    var sc = document.createElement("script");
    sc.src = "/gmp-nav.js";
    document.head.appendChild(sc);
  }

  function boot() {
    var params = new URLSearchParams(location.search);
    var msg = (params.get("msg") || "").replace(/[^0-9a-f-]/gi, "");
    if (msg) {
      try { params.delete("msg"); history.replaceState(null, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash); } catch (e) {}
    }
    loadMe(msg);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
