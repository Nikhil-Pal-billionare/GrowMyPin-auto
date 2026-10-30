// GrowMyPin landing page banners: auto-swiping carousel you control from Admin > Banners.
// window.GMPBanners.mount(element)          loads /api/banners and starts the carousel
// window.GMPBanners.mount(element, data)     uses the given data (admin live preview)
// data = { interval: seconds, items: [{ theme, kicker, title, text, btn, link, image }] }
(function () {
  if (window.GMPBanners) return;
  var RM = false;
  try { RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

  var css =
    ".gbn{position:relative;border-radius:26px;overflow:hidden;isolation:isolate;-webkit-user-select:none;user-select:none;box-shadow:0 26px 50px -34px rgba(9,40,36,.55)}" +
    ".gbn-track{display:flex;transition:transform .6s cubic-bezier(.2,.8,.2,1);touch-action:pan-y;will-change:transform}" +
    ".gbn.drag .gbn-track{transition:none}" +
    ".gbs{position:relative;flex:0 0 100%;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;min-height:clamp(168px,19vw,200px);padding:clamp(18px,3vw,28px) clamp(18px,3.4vw,34px) clamp(34px,4vw,38px);overflow:hidden;font-family:Figtree,system-ui,sans-serif}" +
    ".gbs>*:not(.gmp-sky):not(.gbs-deco){position:relative;z-index:1}" +
    ".gbs .k{display:inline-flex;align-items:center;gap:8px;font-size:.74rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}" +
    ".gbs .k::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px rgba(255,255,255,.18)}" +
    ".gbs h3{color:inherit;margin:0;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:clamp(1.25rem,2.6vw,1.75rem);line-height:1.12;letter-spacing:-.03em;text-wrap:balance}" +
    ".gbs p{margin:6px 0 0;font-size:clamp(.9rem,1.5vw,1rem);line-height:1.45;max-width:58ch}" +
    ".gbs .b{display:inline-flex;align-items:center;gap:8px;margin-top:14px;padding:11px 18px;border-radius:999px;font-weight:800;font-size:.92rem;text-decoration:none;transition:transform .2s,box-shadow .2s;-webkit-user-drag:none}" +
    ".gbs .b:hover{transform:translateY(-2px)}" +
    ".gbs .b svg{width:16px;height:16px}" +
    ".gbs img{display:block;width:clamp(110px,22vw,230px);height:clamp(110px,15vw,150px);object-fit:cover;border-radius:18px;box-shadow:0 18px 30px -18px rgba(0,0,0,.5);pointer-events:none;-webkit-user-drag:none}" +
    ".gbs-deco{position:absolute;right:-40px;top:-40px;width:220px;height:220px;border-radius:50%;opacity:.5;z-index:0;pointer-events:none}" +
    // themes
    ".t-night{color:#fff;background:radial-gradient(70% 140% at 0% 110%,rgba(242,154,46,.45) 0,rgba(140,60,120,.2) 42%,transparent 70%),linear-gradient(120deg,#0E0B33 0%,#1E1557 48%,#3A1F73 100%)}" +
    ".t-night .k{color:#FFC75A}.t-night p{color:#E2DCFF}.t-night .b{color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E);box-shadow:0 14px 28px -14px rgba(242,154,46,.9)}" +
    ".t-green{color:#fff;background:linear-gradient(125deg,#09423D 0%,#0F8A76 60%,#14B88F 100%)}" +
    ".t-green .k{color:#BFF5E3}.t-green p{color:#D7F5EC}.t-green .b{color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E)}" +
    ".t-green .gbs-deco{background:radial-gradient(circle,rgba(255,255,255,.22),transparent 65%)}" +
    ".t-gold{color:#2A1503;background:linear-gradient(125deg,#FFF6E0 0%,#FFE3AE 55%,#FFC97A 100%)}" +
    ".t-gold .k{color:#B4601A}.t-gold p{color:#5A3A12}.t-gold .b{color:#fff;background:#24292F}" +
    ".t-gold .gbs-deco{background:radial-gradient(circle,rgba(255,255,255,.7),transparent 65%)}" +
    ".t-light{color:#24292F;background:linear-gradient(125deg,#FFFFFF 0%,#F1EEFB 55%,#E6F6F0 100%);border:1px solid #E7E4F3}" +
    ".t-light .k{color:#0B7A69}.t-light p{color:#59606E}.t-light .b{color:#fff;background:linear-gradient(135deg,#09423D,#0F8A76 60%,#14B88F);box-shadow:0 14px 28px -16px rgba(9,66,61,.8)}" +
    ".t-light .gbs-deco{background:radial-gradient(circle,rgba(20,184,143,.18),transparent 65%)}" +
    ".t-dark{color:#fff;background:linear-gradient(125deg,#14181C 0%,#24292F 60%,#2E353C 100%)}" +
    ".t-dark .k{color:#34D6A8}.t-dark p{color:#C9CED6}.t-dark .b{color:#062A25;background:#34D6A8}" +
    ".t-dark .gbs-deco{background:radial-gradient(circle,rgba(52,214,168,.22),transparent 65%)}" +
    // controls
    ".gbn-dots{position:absolute;left:0;right:0;bottom:12px;z-index:3;display:flex;justify-content:center;gap:6px}" +
    ".gbn-dots button{position:relative;width:8px;height:8px;padding:0;border:0;border-radius:999px;background:rgba(127,127,140,.45);cursor:pointer;overflow:hidden;transition:width .35s}" +
    ".gbn-dots button.on{width:34px;background:rgba(127,127,140,.35)}" +
    ".gbn-dots button.on i{position:absolute;left:0;top:0;bottom:0;width:0;background:currentColor;border-radius:inherit;animation:gbnFill var(--t) linear forwards}" +
    ".gbn.paused .gbn-dots button.on i{animation-play-state:paused}" +
    ".gbn-dots button i{color:#FFC75A}" +
    ".gbn.lightdots .gbn-dots button i{color:#0F8A76}" +
    ".gbn-arr{position:absolute;top:50%;z-index:3;width:38px;height:38px;margin-top:-19px;border-radius:50%;border:0;background:rgba(255,255,255,.88);color:#24292F;cursor:pointer;display:grid;place-items:center;box-shadow:0 8px 18px -10px rgba(0,0,0,.5);opacity:0;transition:opacity .25s,transform .2s}" +
    ".gbn-arr svg{width:18px;height:18px}.gbn-arr.p{left:10px}.gbn-arr.n{right:10px}" +
    ".gbn:hover .gbn-arr,.gbn:focus-within .gbn-arr{opacity:1}.gbn-arr:hover{transform:scale(1.08)}" +
    "@media (hover:none){.gbn-arr{display:none}}" +
    ".gbn-skel{border-radius:26px;min-height:clamp(168px,19vw,200px);background:linear-gradient(90deg,#EEF0F5 25%,#F7F8FB 50%,#EEF0F5 75%);background-size:200% 100%;animation:gbnSk 1.2s linear infinite}" +
    "@keyframes gbnFill{to{width:100%}}" +
    "@keyframes gbnSk{from{background-position:200% 0}to{background-position:-200% 0}}" +
    "@media (max-width:560px){.gbs{grid-template-columns:minmax(0,1fr)}.gbs img{position:absolute !important;right:14px;top:14px;width:84px;height:84px;border-radius:14px;opacity:.95}.gbs.hasimg .txt{padding-right:92px}.gbs.hasimg .b{margin-top:12px}}" +
    "@media (prefers-reduced-motion:reduce){.gbn-track{transition:opacity .3s}.gbn-dots button.on i{animation:none;width:100%}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function slideHtml(b, i, n) {
    var ext = /^https?:\/\//i.test(b.link || "") && b.link.indexOf(location.origin) !== 0;
    return '<div class="gbs t-' + esc(b.theme || "green") + (b.image ? " hasimg" : "") + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '">' +
      '<span class="gbs-deco" aria-hidden="true"></span>' +
      '<div class="txt">' + (b.kicker ? '<div class="k">' + esc(b.kicker) + '</div>' : "") +
      '<h3>' + esc(b.title) + '</h3>' + (b.text ? '<p>' + esc(b.text) + '</p>' : "") +
      (b.btn && b.link ? '<a class="b" href="' + esc(b.link) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ' draggable="false">' + esc(b.btn) + ARROW + '</a>' : "") + '</div>' +
      (b.image ? '<img src="' + esc(b.image) + '" alt="" loading="' + (i ? "lazy" : "eager") + '" draggable="false">' : "") +
      '</div>';
  }

  function mount(host, given) {
    if (!host) return null;
    var S = { i: 0, n: 0, timer: null, ms: 5000, items: [], paused: false, hidden: false };
    if (host.__gbn) { host.__gbn.destroy(); }
    function render(data) {
      S.items = (data && data.items) || [];
      S.n = S.items.length;
      S.ms = Math.max(2, Math.min(30, Number(data && data.interval) || 5)) * 1000;
      S.i = 0;
      if (!S.n) { host.innerHTML = ""; host.hidden = true; return; }
      host.hidden = false;
      host.innerHTML = '<div class="gbn" role="region" aria-roledescription="carousel" aria-label="GrowMyPin offers">' +
        '<div class="gbn-track">' + S.items.map(function (b, i) { return slideHtml(b, i, S.n); }).join("") + '</div>' +
        (S.n > 1 ? '<button class="gbn-arr p" type="button" aria-label="Previous banner">' + LEFT + '</button><button class="gbn-arr n" type="button" aria-label="Next banner">' + RIGHT + '</button>' +
          '<div class="gbn-dots">' + S.items.map(function (b, i) { return '<button type="button" aria-label="Show banner ' + (i + 1) + '"><i></i></button>'; }).join("") + '</div>' : "") +
        '</div>';
      S.root = host.querySelector(".gbn");
      S.track = host.querySelector(".gbn-track");
      Array.prototype.forEach.call(host.querySelectorAll(".t-night"), function (el) { sky(el); });
      wire();
      go(0, true);
    }
    function sky(el) {
      if (window.GMPSky) { window.GMPSky(el); return; }
      var t = 0, iv = setInterval(function () { if (window.GMPSky || ++t > 20) { clearInterval(iv); if (window.GMPSky && el.isConnected) window.GMPSky(el); } }, 250);
    }
    function go(i, instant) {
      if (!S.n) return;
      S.i = (i + S.n) % S.n;
      if (instant) S.root.classList.add("drag");
      S.track.style.transform = "translateX(" + (-100 * S.i) + "%)";
      if (instant) { void S.track.offsetWidth; S.root.classList.remove("drag"); }
      var cur = S.items[S.i] || {};
      S.root.classList.toggle("lightdots", cur.theme === "light" || cur.theme === "gold");
      Array.prototype.forEach.call(host.querySelectorAll(".gbn-dots button"), function (d, k) {
        d.classList.toggle("on", k === S.i);
        d.setAttribute("aria-current", k === S.i ? "true" : "false");
        var bar = d.querySelector("i"); bar.style.setProperty("--t", S.ms + "ms");
        if (k === S.i) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
      });
      Array.prototype.forEach.call(host.querySelectorAll(".gbs"), function (s, k) {
        s.setAttribute("aria-hidden", k === S.i ? "false" : "true");
        Array.prototype.forEach.call(s.querySelectorAll("a"), function (a) { a.tabIndex = k === S.i ? 0 : -1; });
      });
      restart();
    }
    function restart() {
      clearTimeout(S.timer);
      if (S.n < 2 || S.paused || S.hidden) return;
      S.timer = setTimeout(function () { go(S.i + 1); }, S.ms);
    }
    function pause(on) { S.paused = on; S.root.classList.toggle("paused", on); if (on) clearTimeout(S.timer); else restart(); }
    function onVis() { S.hidden = document.visibilityState !== "visible"; if (S.hidden) clearTimeout(S.timer); else go(S.i); }
    function wire() {
      if (S.n < 2) return;
      host.querySelector(".gbn-arr.p").onclick = function () { go(S.i - 1); };
      host.querySelector(".gbn-arr.n").onclick = function () { go(S.i + 1); };
      Array.prototype.forEach.call(host.querySelectorAll(".gbn-dots button"), function (d, k) { d.onclick = function () { go(k); }; });
      S.root.addEventListener("mouseenter", function () { pause(true); });
      S.root.addEventListener("mouseleave", function () { pause(false); });
      S.root.addEventListener("focusin", function () { pause(true); });
      S.root.addEventListener("focusout", function () { pause(false); });
      S.root.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") go(S.i - 1); if (e.key === "ArrowRight") go(S.i + 1); });
      // swipe with finger or mouse, both directions
      var x0 = null, y0 = 0, dx = 0, moved = false, w = 1, id = null;
      S.track.addEventListener("pointerdown", function (e) {
        if (e.button > 0) return;
        x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; w = S.root.clientWidth || 1; id = e.pointerId;
        clearTimeout(S.timer);
      });
      S.track.addEventListener("pointermove", function (e) {
        if (x0 === null || e.pointerId !== id) return;
        dx = e.clientX - x0;
        if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) {
          moved = true; S.root.classList.add("drag");
          try { S.track.setPointerCapture(id); } catch (er) {}
        }
        if (moved) {
          var edge = (S.i === 0 && dx > 0) || (S.i === S.n - 1 && dx < 0) ? 0.35 : 1;
          S.track.style.transform = "translateX(calc(" + (-100 * S.i) + "% + " + (dx * edge) + "px))";
        }
      });
      function end() {
        if (x0 === null) return;
        S.root.classList.remove("drag");
        if (moved && Math.abs(dx) > Math.min(70, w * 0.18)) go(dx < 0 ? S.i + 1 : S.i - 1);
        else go(S.i);
        x0 = null;
      }
      S.track.addEventListener("pointerup", end);
      S.track.addEventListener("pointercancel", end);
      // a swipe must not open the banner link
      S.track.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      document.addEventListener("visibilitychange", onVis);
    }
    var ctl = {
      update: function (data) { clearTimeout(S.timer); render(data); },
      destroy: function () { clearTimeout(S.timer); document.removeEventListener("visibilitychange", onVis); host.innerHTML = ""; }
    };
    host.__gbn = ctl;
    if (given) render(given);
    else {
      host.innerHTML = '<div class="gbn-skel" aria-hidden="true"></div>';
      fetch("/api/banners", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(render).catch(function () { render({ items: [] }); });
    }
    return ctl;
  }

  window.GMPBanners = { mount: mount };
  // landing page: start by itself
  var hb = document.getElementById("heroBanners");
  if (hb && !hb.__gbn) mount(hb);
})();
