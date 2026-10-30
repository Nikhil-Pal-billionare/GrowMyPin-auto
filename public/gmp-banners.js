// GrowMyPin landing page banners: image carousel like Flipkart / Amazon, managed in Admin > Banners.
// - The whole banner is one clickable link (the link you set in admin).
// - Image covers the full banner. Best image size: 1200 x 600 px (2 : 1). Without an image a colored text banner is shown.
// - Phone: 1 banner at a time. Computer (768px+): 2 banners side by side.
// - Swipes by itself (time from admin, default 5 s). Swipe left / right with finger or mouse.
// window.GMPBanners.mount(element)          loads /api/banners
// window.GMPBanners.mount(element, data)     uses the given data (admin live preview)
// data = { interval: seconds, items: [{ theme, kicker, title, text, btn, link, image }] }
(function () {
  if (window.GMPBanners) return;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }

  var GAP_PC = 16, GAP_PH = 10;
  var css =
    ".gbn{display:block;position:relative;-webkit-user-select:none;user-select:none;--gap:" + GAP_PH + "px}" +
    "@media (min-width:768px){.gbn{--gap:" + GAP_PC + "px}}" +
    ".gbn-view{overflow:hidden;border-radius:20px}" +
    ".gbn-track{display:flex;gap:var(--gap);transition:transform .6s cubic-bezier(.2,.8,.2,1);touch-action:pan-y;will-change:transform}" +
    ".gbn.drag .gbn-track{transition:none}" +
    ".gbs{position:relative;flex:0 0 100%;min-width:0;aspect-ratio:2/1;border-radius:20px;overflow:hidden;display:block;text-decoration:none;isolation:isolate;-webkit-user-drag:none;box-shadow:0 18px 36px -26px rgba(9,40,36,.55);font-family:Figtree,system-ui,sans-serif}" +
    "@media (min-width:768px){.gbn.gbn-2 .gbs{flex-basis:calc(50% - var(--gap) / 2)}.gbn.gbn-1 .gbs{flex-basis:calc(50% - var(--gap) / 2);margin:0 auto}}" +
    ".gbs img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none}" +
    ".gbs:focus-visible{outline:3px solid #0F9682;outline-offset:3px}" +
    // text banner (no image)
    ".gbs .tx{position:absolute;inset:0;z-index:1;display:grid;align-content:center;gap:4px;padding:6% 7%}" +
    ".gbs .k{display:inline-flex;align-items:center;gap:7px;font-size:clamp(.62rem,1.9vw,.74rem);font-weight:800;letter-spacing:.1em;text-transform:uppercase}" +
    ".gbs .k::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}" +
    ".gbs h3{color:inherit;margin:0;font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:clamp(1.05rem,4.6vw,1.6rem);line-height:1.12;letter-spacing:-.03em;text-wrap:balance}" +
    "@media (min-width:768px){.gbs h3{font-size:clamp(1.1rem,2vw,1.55rem)}}" +
    ".gbs p{margin:0;font-size:clamp(.78rem,2.9vw,.95rem);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
    "@media (min-width:768px){.gbs p{font-size:clamp(.8rem,1.15vw,.95rem)}}" +
    ".gbs .b{justify-self:start;display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:8px 14px;border-radius:999px;font-weight:800;font-size:clamp(.74rem,2.6vw,.88rem)}" +
    ".gbs .b svg{width:14px;height:14px}" +
    ".gbs .deco{position:absolute;right:-12%;top:-30%;width:60%;aspect-ratio:1;border-radius:50%;opacity:.55;z-index:0;pointer-events:none}" +
    ".t-night{color:#fff;background:radial-gradient(70% 140% at 0% 110%,rgba(242,154,46,.45) 0,rgba(140,60,120,.2) 42%,transparent 70%),linear-gradient(120deg,#0E0B33 0%,#1E1557 48%,#3A1F73 100%)}" +
    ".t-night .k{color:#FFC75A}.t-night p{color:#E2DCFF}.t-night .b{color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E)}" +
    ".t-night>*:not(.gmp-sky){position:relative}.t-night .tx{position:absolute}" +
    ".t-green{color:#fff;background:linear-gradient(125deg,#09423D 0%,#0F8A76 60%,#14B88F 100%)}" +
    ".t-green .k{color:#BFF5E3}.t-green p{color:#D7F5EC}.t-green .b{color:#2A1503;background:linear-gradient(135deg,#FFE08A,#FFC75A 40%,#F29A2E)}" +
    ".t-green .deco{background:radial-gradient(circle,rgba(255,255,255,.22),transparent 65%)}" +
    ".t-gold{color:#2A1503;background:linear-gradient(125deg,#FFF6E0 0%,#FFE3AE 55%,#FFC97A 100%)}" +
    ".t-gold .k{color:#B4601A}.t-gold p{color:#5A3A12}.t-gold .b{color:#fff;background:#24292F}" +
    ".t-gold .deco{background:radial-gradient(circle,rgba(255,255,255,.7),transparent 65%)}" +
    ".t-light{color:#24292F;background:linear-gradient(125deg,#FFFFFF 0%,#F1EEFB 55%,#E6F6F0 100%);box-shadow:inset 0 0 0 1px #E7E4F3,0 18px 36px -26px rgba(9,40,36,.45)}" +
    ".t-light .k{color:#0B7A69}.t-light p{color:#59606E}.t-light .b{color:#fff;background:linear-gradient(135deg,#09423D,#0F8A76 60%,#14B88F)}" +
    ".t-light .deco{background:radial-gradient(circle,rgba(20,184,143,.18),transparent 65%)}" +
    ".t-dark{color:#fff;background:linear-gradient(125deg,#14181C 0%,#24292F 60%,#2E353C 100%)}" +
    ".t-dark .k{color:#34D6A8}.t-dark p{color:#C9CED6}.t-dark .b{color:#062A25;background:#34D6A8}" +
    ".t-dark .deco{background:radial-gradient(circle,rgba(52,214,168,.22),transparent 65%)}" +
    // dots + arrows
    ".gbn-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}" +
    ".gbn-dots button{position:relative;width:7px;height:7px;padding:0;border:0;border-radius:999px;background:#CDD2DC;cursor:pointer;overflow:hidden;transition:width .35s,background .35s}" +
    ".gbn-dots button.on{width:28px;background:#DCE0E8}" +
    ".gbn-dots button.on i{position:absolute;left:0;top:0;bottom:0;width:0;background:#0F8A76;border-radius:inherit;animation:gbnFill var(--t) linear forwards}" +
    ".gbn.paused .gbn-dots button.on i{animation-play-state:paused}" +
    ".gbn-arr{position:absolute;top:calc(50% - 14px);z-index:3;width:40px;height:40px;margin-top:-20px;border-radius:50%;border:0;background:rgba(255,255,255,.94);color:#24292F;cursor:pointer;display:grid;place-items:center;box-shadow:0 8px 20px -8px rgba(0,0,0,.45);opacity:0;transition:opacity .25s,transform .2s}" +
    ".gbn-arr svg{width:18px;height:18px}.gbn-arr.p{left:-6px}.gbn-arr.n{right:-6px}" +
    ".gbn:hover .gbn-arr,.gbn:focus-within .gbn-arr{opacity:1}.gbn-arr:hover{transform:scale(1.08)}" +
    "@media (hover:none){.gbn-arr{display:none}}" +
    ".gbn-skel{border-radius:20px;aspect-ratio:2/1;background:linear-gradient(90deg,#EEF0F5 25%,#F7F8FB 50%,#EEF0F5 75%);background-size:200% 100%;animation:gbnSk 1.2s linear infinite}" +
    "@media (min-width:768px){.gbn-skel{aspect-ratio:4/1}}" +
    "@keyframes gbnFill{to{width:100%}}" +
    "@keyframes gbnSk{from{background-position:200% 0}to{background-position:-200% 0}}" +
    "@media (prefers-reduced-motion:reduce){.gbn-track{transition:none}.gbn-dots button.on i{animation:none;width:100%}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var PC = window.matchMedia ? window.matchMedia("(min-width: 768px)") : { matches: false };

  function slideHtml(b, i, n) {
    var link = b.link || "";
    var ext = /^https?:\/\//i.test(link) && link.indexOf(location.origin) !== 0;
    var tag = link ? "a" : "div";
    var attrs = link ? ' href="' + esc(link) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ' draggable="false"' : "";
    var label = b.title || b.kicker || ("Banner " + (i + 1));
    var inner = b.image
      ? '<img src="' + esc(b.image) + '" alt="' + esc(label) + '" loading="' + (i < 2 ? "eager" : "lazy") + '" draggable="false">'
      : '<span class="deco" aria-hidden="true"></span><span class="tx">' + (b.kicker ? '<span class="k">' + esc(b.kicker) + '</span>' : "") +
        '<h3>' + esc(b.title) + '</h3>' + (b.text ? '<p>' + esc(b.text) + '</p>' : "") +
        (b.btn ? '<span class="b">' + esc(b.btn) + ARROW + '</span>' : "") + '</span>';
    return '<' + tag + ' class="gbs' + (b.image ? " img" : " t-" + esc(b.theme || "green")) + '"' + attrs +
      ' role="group" aria-roledescription="slide" aria-label="' + esc(label) + ' (' + (i + 1) + ' of ' + n + ')">' + inner + '</' + tag + '>';
  }

  function mount(host, given) {
    if (!host) return null;
    if (host.__gbn) host.__gbn.destroy();
    var S = { i: 0, n: 0, timer: null, ms: 5000, items: [], paused: false, hidden: false, per: 1 };
    function positions() { return S.per === 2 ? Math.max(1, S.n - 1) : S.n; }
    function gap() { return S.per === 2 ? GAP_PC : GAP_PH; }
    function offset(i, px) {
      // one step = one banner width + gap. Phone: 100% + gap. Computer: 50% + gap / 2.
      var stepPct = S.per === 2 ? 50 : 100, stepPx = S.per === 2 ? gap() / 2 : gap();
      return "translateX(calc(" + (-stepPct * i) + "% - " + (stepPx * i) + "px" + (px ? " + " + px + "px" : "") + "))";
    }
    function render(data) {
      S.items = (data && data.items) || [];
      S.n = S.items.length;
      S.ms = Math.max(2, Math.min(30, Number(data && data.interval) || 5)) * 1000;
      S.i = 0;
      if (!S.n) { host.innerHTML = ""; host.hidden = true; return; }
      host.hidden = false;
      S.per = PC.matches && S.n > 1 ? 2 : 1;
      var dots = positions();
      host.innerHTML = '<div class="gbn ' + (S.n === 1 ? "gbn-1" : "gbn-2") + '" role="region" aria-roledescription="carousel" aria-label="GrowMyPin offers">' +
        '<div class="gbn-view"><div class="gbn-track">' + S.items.map(function (b, i) { return slideHtml(b, i, S.n); }).join("") + '</div></div>' +
        (dots > 1 ? '<button class="gbn-arr p" type="button" aria-label="Previous banner">' + LEFT + '</button><button class="gbn-arr n" type="button" aria-label="Next banner">' + RIGHT + '</button>' +
          '<div class="gbn-dots">' + Array.apply(null, Array(dots)).map(function (x, i) { return '<button type="button" aria-label="Show banner ' + (i + 1) + '"><i></i></button>'; }).join("") + '</div>' : "") +
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
      var max = positions();
      S.i = (i + max) % max;
      if (instant) S.root.classList.add("drag");
      S.track.style.transform = offset(S.i);
      if (instant) { void S.track.offsetWidth; S.root.classList.remove("drag"); }
      Array.prototype.forEach.call(host.querySelectorAll(".gbn-dots button"), function (d, k) {
        d.classList.toggle("on", k === S.i);
        d.setAttribute("aria-current", k === S.i ? "true" : "false");
        var bar = d.querySelector("i"); bar.style.setProperty("--t", S.ms + "ms");
        if (k === S.i) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; }
      });
      Array.prototype.forEach.call(host.querySelectorAll(".gbs"), function (s, k) {
        var vis = k >= S.i && k < S.i + S.per;
        s.setAttribute("aria-hidden", vis ? "false" : "true");
        if (s.tagName === "A") s.tabIndex = vis ? 0 : -1;
      });
      restart();
    }
    function restart() {
      clearTimeout(S.timer);
      if (positions() < 2 || S.paused || S.hidden) return;
      S.timer = setTimeout(function () { go(S.i + 1); }, S.ms);
    }
    function pause(on) { S.paused = on; S.root.classList.toggle("paused", on); if (on) clearTimeout(S.timer); else restart(); }
    function onVis() { S.hidden = document.visibilityState !== "visible"; if (S.hidden) clearTimeout(S.timer); else go(S.i); }
    function onMedia() { var want = PC.matches && S.n > 1 ? 2 : 1; if (want !== S.per) render({ items: S.items, interval: S.ms / 1000 }); }
    function wire() {
      if (positions() < 2) return;
      host.querySelector(".gbn-arr.p").onclick = function () { go(S.i - 1); };
      host.querySelector(".gbn-arr.n").onclick = function () { go(S.i + 1); };
      Array.prototype.forEach.call(host.querySelectorAll(".gbn-dots button"), function (d, k) { d.onclick = function () { go(k); }; });
      S.root.addEventListener("mouseenter", function () { pause(true); });
      S.root.addEventListener("mouseleave", function () { pause(false); });
      S.root.addEventListener("focusin", function () { pause(true); });
      S.root.addEventListener("focusout", function () { pause(false); });
      S.root.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") go(S.i - 1); if (e.key === "ArrowRight") go(S.i + 1); });
      // swipe with finger or mouse, both directions
      var x0 = null, y0 = 0, dx = 0, moved = false, id = null;
      S.track.addEventListener("pointerdown", function (e) {
        if (e.button > 0) return;
        x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; id = e.pointerId;
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
          var edge = (S.i === 0 && dx > 0) || (S.i === positions() - 1 && dx < 0) ? 0.35 : 1;
          S.track.style.transform = offset(S.i, Math.round(dx * edge));
        }
      });
      function end() {
        if (x0 === null) return;
        S.root.classList.remove("drag");
        var w = (S.root.clientWidth || 1) / S.per;
        if (moved && Math.abs(dx) > Math.min(60, w * 0.18)) go(dx < 0 ? S.i + 1 : S.i - 1);
        else go(S.i);
        x0 = null;
      }
      S.track.addEventListener("pointerup", end);
      S.track.addEventListener("pointercancel", end);
      // a swipe must not open the banner link
      S.track.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }
    document.addEventListener("visibilitychange", onVis);
    if (PC.addEventListener) PC.addEventListener("change", onMedia);
    var ctl = {
      update: function (data) { clearTimeout(S.timer); render(data); },
      destroy: function () {
        clearTimeout(S.timer);
        document.removeEventListener("visibilitychange", onVis);
        if (PC.removeEventListener) PC.removeEventListener("change", onMedia);
        host.innerHTML = ""; host.__gbn = null;
      }
    };
    host.__gbn = ctl;
    if (given) render(given);
    else {
      host.innerHTML = '<div class="gbn-skel" aria-hidden="true"></div>';
      fetch("/api/banners", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
        render(d);
        // landing page pins (right side animation) come in the same answer
        if (d && d.showcase && d.showcase.length) {
          window.GMPShowcase = d.showcase;
          try { window.dispatchEvent(new CustomEvent("gmp:showcase", { detail: d.showcase })); } catch (e) {}
        }
      }).catch(function () { render({ items: [] }); });
    }
    return ctl;
  }

  window.GMPBanners = { mount: mount };
  // landing page: start by itself
  var hb = document.getElementById("heroBanners");
  if (hb && !hb.__gbn) mount(hb);
})();
