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

  function send(kind) {
    var body = JSON.stringify({ vid: vid, sid: sid, kind: kind, path: path, ref: document.referrer || "" });
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
    "background:radial-gradient(120% 60% at 50% 120%,#3A2108 0,#1A1407 30%,transparent 60%),radial-gradient(90% 60% at 50% -10%,#0F3B35 0,transparent 60%),#061815;box-shadow:0 50px 90px -30px rgba(0,0,0,.75);animation:gmpPop .6s cubic-bezier(.2,1.2,.3,1)}" +
    ".gmp-vp .k{font-size:.92rem;color:#A9C2BC;font-weight:600}" +
    ".gmp-vp .nums{font-family:Montserrat,system-ui,sans-serif;font-weight:800;letter-spacing:-.04em;line-height:1;margin:6px 0 4px;font-size:clamp(2.2rem,9vw,3.3rem);background:linear-gradient(180deg,#FFF3C4 10%,#FFC75A 55%,#F29A2E);-webkit-background-clip:text;background-clip:text;color:transparent}" +
    ".gmp-vp .nums small{font-size:.45em;letter-spacing:0;vertical-align:.35em;margin:0 .25em;-webkit-text-fill-color:#A9C2BC}" +
    ".gmp-vp .u{font-size:.9rem;color:#CFE2DD}" +
    ".gmp-vp h3{margin:18px 0 6px;font-family:Montserrat,system-ui,sans-serif;font-size:1.35rem;letter-spacing:-.02em;color:#fff}" +
    ".gmp-vp svg{display:block;width:100%;height:auto;margin:4px 0 6px;overflow:visible}" +
    ".gmp-vp .note{font-size:.76rem;color:#7F9893;margin-bottom:16px}" +
    ".gmp-vp .acts{display:grid;gap:8px;justify-items:center}" +
    ".gmp-vp .yes{width:100%;border:0;border-radius:999px;padding:16px 20px;font:inherit;font-weight:800;font-size:1.05rem;color:#2A1503;cursor:pointer;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);box-shadow:0 18px 40px -14px rgba(242,154,46,.8)}" +
    ".gmp-vp .no{border:0;background:none;color:#9DB3AE;font:inherit;font-weight:600;padding:8px 14px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}" +
    ".gmp-vp .x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#fff;font-size:1.2rem;cursor:pointer}" +
    ".gmp-vp .done{text-align:center;display:grid;gap:12px;justify-items:center;padding:12px 0 4px}" +
    ".gmp-vp .done b{font-family:Montserrat,system-ui,sans-serif;font-size:1.4rem}" +
    ".gmp-vp .done a{display:inline-flex;padding:13px 22px;border-radius:999px;background:#25D366;color:#06301A;text-decoration:none;font-weight:800}" +
    ".gmp-vp .chk{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:rgba(52,214,168,.15);color:#34D6A8;font-size:2rem;animation:gmpPop .5s cubic-bezier(.2,1.6,.3,1)}"
  );

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
      var m = GR.model(p || "etsy", (g.links || {})[p] || "", { target: g.target || 100, hasPin: !!g.has_pinterest });
      var bg = document.createElement("div");
      bg.className = "gmp-vp-bg";
      bg.setAttribute("role", "dialog");
      bg.setAttribute("aria-modal", "true");
      bg.innerHTML =
        '<div class="gmp-vp">' +
        '<button class="x" type="button" aria-label="Close">&times;</button>' +
        '<div class="k">Your Pinterest views can reach</div>' +
        '<div class="nums"><span class="a">0</span><small>to</small><span class="b">0</span></div>' +
        '<div class="u">monthly views in 6 months</div>' +
        '<h3></h3>' +
        '<svg role="img" aria-label="Your store visits rising over 6 months"></svg>' +
        '<div class="note">Estimate for your shop, based on similar sellers posting pins every day.</div>' +
        '<div class="acts"><button class="yes" type="button"></button><button class="no" type="button"></button></div>' +
        '</div>';
      bg.querySelector("h3").textContent = tpl(SET.popup_title || "Increase your {store} store visits", { store: store });
      bg.querySelector(".yes").textContent = SET.popup_yes_btn || "I want to increase visits";
      bg.querySelector(".no").textContent = SET.popup_no_btn || "I'll do later";
      document.body.appendChild(bg);
      GR.countUp(bg.querySelector(".a"), m.worst[6], 1400);
      GR.countUp(bg.querySelector(".b"), m.best[6], 1800);
      GR.drawRise(bg.querySelector("svg"), m, {});
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
        }).catch(function () { btn.disabled = false; btn.textContent = "Try again"; });
      });
    });
  }

  function loadMe(msgId) {
    var q = "/api/user/me?lite=1" + (msgId ? "&msg=" + encodeURIComponent(msgId) : "");
    return api(q).then(function (me) {
      if (!me) return;
      SET = me.settings || {};
      window.GMPSettings = SET;
      if (!me.user) { ribbon(false); return; }
      ME = me;
      window.GMPMe = me;
      vapid = me.vapid || "";
      if (me.is_admin) addAdminLink();
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
