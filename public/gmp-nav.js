// GrowMyPin bottom navigation bar (loaded by gmp.js for logged-in people on every page,
// except sign up, admin and password reset).
//   Home         -> /home.html
//   Search       -> search anything in the Studio (pages, actions, help)
//   Performance  -> your growth graph + Pinterest views (/home.html#performance)
//   Profile      -> your account, Pinterest, plan, store links, log out
//   More         -> Pin Studio, notifications, install app, WhatsApp help, policies
(function () {
  if (window.GMPNav) return;
  var path = location.pathname || "/";
  var isHome = /^\/home(\.html)?$/.test(path);
  var RM = false;
  try { RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function me() { return window.GMPMe || {}; }
  function set() { return window.GMPSettings || {}; }
  function api(p, body) {
    var o = { credentials: "same-origin", headers: {} };
    if (body) { o.method = "POST"; o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
    return fetch(p, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Request failed"); return j; }); });
  }

  // ---------------- icons ----------------
  function ic(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var I = {
    home: ic('<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5"/>'),
    search: ic('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>'),
    perf: ic('<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>'),
    user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    menu: ic('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>'),
    pin: ic('<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
    store: ic('<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v2a3 3 0 01-6 0 3 3 0 01-4 0 3 3 0 01-6 0z"/><path d="M5 13v7h14v-7"/>'),
    bell: ic('<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 21h4"/>'),
    phone: ic('<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>'),
    chat: ic('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8"/><path d="M8 13h5"/>'),
    doc: ic('<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h7"/><path d="M9 17h7"/>'),
    shield: ic('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    out: ic('<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>'),
    star: ic('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
    tag: ic('<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>'),
    goal: ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
    admin: ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    arrow: ic('<path d="M9 6l6 6-6 6"/>'),
    link: ic('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>')
  };

  // ---------------- styles ----------------
  var css =
    "body.has-gnav{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px)) !important}" +
    "body.has-gnav .gmp-ribbon{bottom:calc(92px + env(safe-area-inset-bottom,0px)) !important}" +
    "body.has-gnav .sticky-cta{bottom:calc(92px + env(safe-area-inset-bottom,0px)) !important}" +
    ".gnav{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:150;width:min(480px,calc(100% - 20px));" +
    "display:grid;grid-template-columns:repeat(5,minmax(0,1fr));padding:6px;border-radius:24px;background:rgba(255,255,255,.88);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);" +
    "border:1px solid rgba(36,41,47,.08);box-shadow:0 18px 40px -18px rgba(9,40,36,.45),0 2px 6px rgba(9,40,36,.06);font-family:Figtree,system-ui,sans-serif;animation:gnavIn .5s cubic-bezier(.2,.8,.2,1)}" +
    ".gnav .ind{position:absolute;top:6px;bottom:6px;left:6px;width:calc((100% - 12px) / 5);border-radius:18px;background:linear-gradient(160deg,#E6F6F0,#D3F0E5);transition:transform .4s cubic-bezier(.2,.8,.2,1),opacity .3s;pointer-events:none}" +
    ".gnav button,.gnav a{position:relative;z-index:1;display:grid;justify-items:center;gap:2px;padding:7px 0 6px;border:0;background:none;font:inherit;color:#6B7280;text-decoration:none;cursor:pointer;border-radius:18px;-webkit-tap-highlight-color:transparent;min-width:0}" +
    ".gnav svg{width:23px;height:23px;transition:transform .35s cubic-bezier(.2,1.6,.4,1)}" +
    ".gnav span{font-size:clamp(.6rem,2.75vw,.7rem);font-weight:700;letter-spacing:-.01em;line-height:1.1;white-space:nowrap;max-width:100%}" +
    ".gnav .on{color:#0B7A69}.gnav .on svg{transform:translateY(-1px) scale(1.08)}" +
    ".gnav button:active svg,.gnav a:active svg{transform:scale(.88)}" +
    ".gnav .dot{position:absolute;top:6px;right:calc(50% - 16px);width:8px;height:8px;border-radius:50%;background:#F29A2E;box-shadow:0 0 0 2px #fff}" +
    ".gnav :focus-visible{outline:3px solid #0F9682;outline-offset:-2px}" +
    // sheets
    ".gsh-bg{position:fixed;inset:0;z-index:180;background:rgba(14,22,20,.42);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:gshFade .25s ease;display:flex;align-items:flex-end;justify-content:center}" +
    ".gsh{width:min(560px,100%);max-height:88vh;overflow-y:auto;background:#fff;border-radius:28px 28px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -20px 50px -20px rgba(0,0,0,.35);animation:gshUp .38s cubic-bezier(.2,.8,.2,1);font-family:Figtree,system-ui,sans-serif;color:#24292F}" +
    "@media (min-width:700px){.gsh-bg{align-items:center;padding:16px}.gsh{border-radius:28px;padding-bottom:22px;animation:gshPop .3s cubic-bezier(.2,.8,.2,1)}}" +
    ".gsh .grab{width:42px;height:5px;border-radius:5px;background:#E1E4EB;margin:0 auto 12px}" +
    "@media (min-width:700px){.gsh .grab{display:none}}" +
    ".gsh h3{margin:0 0 12px;font-family:Montserrat,system-ui,sans-serif;font-size:1.2rem;letter-spacing:-.02em}" +
    ".gsh .x{float:right;width:36px;height:36px;border-radius:50%;border:0;background:#F2F3F7;font-size:1.3rem;line-height:1;cursor:pointer;color:#24292F}" +
    ".gsh .lbl{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8A90A0;margin:16px 4px 8px}" +
    // rows + tiles
    ".gsh .rows{display:grid;gap:6px}" +
    ".gsh .row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px;border-radius:16px;text-decoration:none;color:inherit;background:#FAFAFD;border:1px solid #F0F1F5;cursor:pointer;font:inherit;text-align:left;width:100%}" +
    ".gsh .row:hover,.gsh .row.sel{background:#F1FAF6;border-color:#CDEEE1}" +
    ".gsh .row .i{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#E6F6F0;color:#0B7A69}" +
    ".gsh .row .i.w{background:#FFF1DC;color:#B4601A}.gsh .row .i.v{background:#EEEAFD;color:#5B4BC4}.gsh .row .i.r{background:#FCE6EB;color:#A3243F}" +
    ".gsh .row .i svg{width:21px;height:21px}" +
    ".gsh .row b{display:block;font-size:.95rem;font-weight:700}" +
    ".gsh .row small{display:block;font-size:.8rem;color:#6B7280;line-height:1.35;overflow:hidden;text-overflow:ellipsis}" +
    ".gsh .row .go{color:#B4BAC6}.gsh .row .go svg{width:18px;height:18px}" +
    ".gsh .tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}" +
    ".gsh .tile{display:grid;justify-items:center;text-align:center;gap:6px;padding:14px 6px 12px;border-radius:18px;background:#FAFAFD;border:1px solid #F0F1F5;text-decoration:none;color:#24292F;font:inherit;cursor:pointer}" +
    ".gsh .tile:hover{background:#F1FAF6;border-color:#CDEEE1}" +
    ".gsh .tile .i{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#E6F6F0;color:#0B7A69}" +
    ".gsh .tile .i.w{background:#FFF1DC;color:#B4601A}.gsh .tile .i.v{background:#EEEAFD;color:#5B4BC4}.gsh .tile .i.r{background:#FCE6EB;color:#A3243F}" +
    ".gsh .tile svg{width:22px;height:22px}.gsh .tile b{font-size:.84rem;font-weight:700;line-height:1.2}.gsh .tile small{font-size:.72rem;color:#6B7280;line-height:1.25}" +
    ".gsh .note{font-size:.84rem;color:#0B7A69;font-weight:600;min-height:1.1em;margin:10px 4px 0}" +
    // search
    ".gsh .sbox{position:relative;margin-bottom:6px}" +
    ".gsh .sbox svg{position:absolute;left:14px;top:50%;width:20px;height:20px;transform:translateY(-50%);color:#8A90A0}" +
    ".gsh .sbox input{width:100%;border:1.5px solid #E4E6EE;border-radius:16px;padding:14px 14px 14px 44px;font:inherit;font-size:1rem;background:#fff;color:#24292F}" +
    ".gsh .sbox input:focus{outline:none;border-color:#0F9682;box-shadow:0 0 0 4px rgba(15,150,130,.15)}" +
    ".gsh .empty{padding:22px 8px;text-align:center;color:#6B7280;font-size:.92rem}" +
    ".gsh mark{background:#FFF1C7;color:inherit;border-radius:3px;padding:0 1px}" +
    // profile
    ".gsh .pf{display:grid;grid-template-columns:62px minmax(0,1fr);gap:14px;align-items:center;padding:14px;border-radius:22px;background:linear-gradient(135deg,#09423D,#0F8A76 70%,#14B88F);color:#fff}" +
    ".gsh .pf .av{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);font-family:Montserrat,system-ui,sans-serif;font-weight:800;font-size:1.6rem;box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}" +
    ".gsh .pf b{display:block;font-family:Montserrat,system-ui,sans-serif;font-size:1.15rem;letter-spacing:-.02em}" +
    ".gsh .pf span{display:block;font-size:.86rem;color:#D7F5EC;overflow:hidden;text-overflow:ellipsis}" +
    ".gsh .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}" +
    ".gsh .chip{display:inline-block;font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#F1EEFB;color:#24292F;text-decoration:none}" +
    ".gsh .skel{height:56px;border-radius:16px;background:linear-gradient(90deg,#EEF0F5 25%,#F7F8FB 50%,#EEF0F5 75%);background-size:200% 100%;animation:gshSk 1.2s linear infinite}" +
    "@keyframes gnavIn{from{transform:translate(-50%,120%)}to{transform:translate(-50%,0)}}" +
    "@keyframes gshFade{from{opacity:0}to{opacity:1}}" +
    "@keyframes gshUp{from{transform:translateY(100%)}to{transform:none}}" +
    "@keyframes gshPop{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}" +
    "@keyframes gshSk{from{background-position:200% 0}to{background-position:-200% 0}}" +
    "@media (max-width:360px){.gnav{width:calc(100% - 12px);padding:5px}.gnav svg{width:21px;height:21px}}" +
    "@media (prefers-reduced-motion:reduce){.gnav,.gsh,.gsh-bg{animation:none}.gnav .ind,.gnav svg{transition:none}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // ---------------- home page helpers ----------------
  // sections on /home.html that other pages can jump to: /home.html#performance etc.
  var SECTIONS = { performance: "predCard", pins: "pinCard", store: "storeCard", goal: "goalCard", plans: "planBox", setup: "steps" };
  function goSection(key) {
    if (!isHome) { location.href = "/home.html#" + key; return; }
    var tries = 0;
    (function find() {
      var el = document.getElementById(SECTIONS[key] || "");
      if (el && !el.hidden && el.offsetParent !== null) {
        el.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
        if (key === "store") { var b = document.getElementById("editShop"); if (b && !b.hidden) setTimeout(function () { b.click(); }, 500); }
        try { history.replaceState(null, "", "/home.html#" + key); } catch (e) {}
        return;
      }
      if (++tries < 40) setTimeout(find, 150);
    })();
  }
  function hasPlans() { var b = document.getElementById("planBox"); return !!(b && !b.hidden); }

  // ---------------- sheets ----------------
  var openSheet = null;
  function sheet(title, html, onReady) {
    closeSheet();
    var bg = document.createElement("div");
    bg.className = "gsh-bg";
    bg.innerHTML = '<div class="gsh" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="grab" aria-hidden="true"></div><button class="x" type="button" aria-label="Close">&times;</button><h3>' + esc(title) + '</h3><div class="sb">' + html + '</div></div>';
    document.body.appendChild(bg);
    bg.addEventListener("click", function (e) { if (e.target === bg || e.target.closest(".x")) closeSheet(); });
    // swipe down to close (phones)
    var sh = bg.querySelector(".gsh"), y0 = null;
    sh.addEventListener("touchstart", function (e) { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    sh.addEventListener("touchmove", function (e) { if (y0 === null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = "translateY(" + dy + "px)"; }, { passive: true });
    sh.addEventListener("touchend", function (e) { if (y0 === null) return; var dy = (e.changedTouches[0].clientY - y0); sh.style.transform = ""; y0 = null; if (dy > 110) closeSheet(); });
    openSheet = bg;
    if (onReady) onReady(bg.querySelector(".sb"));
    return bg;
  }
  function closeSheet() { if (openSheet) { openSheet.remove(); openSheet = null; } setActive(currentTab()); }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openSheet) closeSheet();
    // "/" or Ctrl+K opens search on computers
    var t = e.target && e.target.tagName;
    if (!openSheet && t !== "INPUT" && t !== "TEXTAREA" && t !== "SELECT" && (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"))) { e.preventDefault(); openSearch(); }
  });

  function row(it) {
    var tag = it.href ? "a" : "button";
    return '<' + tag + ' class="row" ' + (it.href ? 'href="' + esc(it.href) + '"' + (it.ext ? ' target="_blank" rel="noopener"' : "") : 'type="button"') + ' data-k="' + esc(it.k || "") + '">' +
      '<span class="i ' + (it.c || "") + '">' + I[it.ic] + '</span><span><b>' + (it.bh || esc(it.t)) + '</b><small>' + (it.sh || esc(it.s || "")) + '</small></span><span class="go">' + I.arrow + '</span></' + tag + '>';
  }
  function tile(it) {
    var tag = it.href ? "a" : "button";
    return '<' + tag + ' class="tile" ' + (it.href ? 'href="' + esc(it.href) + '"' + (it.ext ? ' target="_blank" rel="noopener"' : "") : 'type="button"') + ' data-k="' + esc(it.k || "") + '">' +
      '<span class="i ' + (it.c || "") + '">' + I[it.ic] + '</span><b>' + esc(it.t) + '</b>' + (it.s ? '<small>' + esc(it.s) + '</small>' : "") + '</' + tag + '>';
  }
  function wa() { return String(set().sales_whatsapp || "").replace(/\D/g, ""); }

  // things a person can do: used by Search and More
  function actions() {
    var list = [
      { k: "home", t: "Home", s: "Your shop, Pinterest and growth in one place", ic: "home", href: "/home.html", w: "home dashboard start main" },
      { k: "performance", t: "Performance", s: "Growth graph, monthly views and store visits", ic: "perf", w: "performance growth graph forecast views visits analytics stats numbers prediction strategy", act: true },
      { k: "pins", t: "My Pinterest pins", s: "Your latest pins and last 30 days views", ic: "pin", c: "r", w: "pins pinterest my pins views impressions", act: true },
      { k: "studio", t: "Make new pins", s: "Pin Studio: AI drafts, you approve every pin", ic: "star", c: "w", href: "/app.html", w: "make create new pin studio ai draft publish post upload" },
      { k: "connect", t: "Connect Pinterest", s: "See your real views and pins here", ic: "link", href: "/api/auth/login?next=/home.html", w: "connect pinterest login link account" },
      { k: "store", t: "My store links", s: "Etsy, Shopify or eBay links", ic: "store", c: "w", w: "store shop etsy shopify ebay link edit", act: true },
      { k: "goal", t: "My sales goal", s: "Sales you want each month", ic: "goal", c: "v", w: "goal sales target month", act: true },
      { k: "profile", t: "My profile", s: "Account, plan, Pinterest and log out", ic: "user", c: "v", w: "profile account email phone plan me settings", act: true },
      { k: "alerts", t: "Turn on notifications", s: "Get GrowMyPin updates on this phone", ic: "bell", c: "w", w: "notifications alerts push bell updates", act: true },
      { k: "install", t: "Install the app", s: "Add GrowMyPin to your home screen", ic: "phone", w: "install app home screen download add", act: true },
      { k: "terms", t: "Terms of Service", s: "The rules for using the Studio", ic: "doc", href: "/terms.html", w: "terms service rules legal" },
      { k: "privacy", t: "Privacy Policy", s: "What data we keep and why", ic: "shield", href: "/privacy.html", w: "privacy data policy delete" },
      { k: "billing", t: "Billing and refunds", s: "Payments, cancelling and refunds", ic: "doc", c: "w", href: "/billing.html", w: "billing refund payment cancel money invoice" },
      { k: "aup", t: "Acceptable use", s: "What is not allowed", ic: "doc", c: "v", href: "/acceptable-use.html", w: "acceptable use rules allowed" },
      { k: "logout", t: "Log out", s: "Sign out of this device", ic: "out", c: "r", w: "logout log out sign out exit", act: true }
    ];
    if (hasPlans()) list.splice(4, 0, { k: "plans", t: "Plans", s: "Pick a plan and start growing", ic: "tag", c: "v", w: "plans price pricing pay buy subscribe offer diwali upgrade", act: true });
    if (wa()) list.splice(list.length - 5, 0, { k: "wa", t: "Help on WhatsApp", s: "Chat with the GrowMyPin team", ic: "chat", href: "https://wa.me/" + wa() + "?text=" + encodeURIComponent("Hi GrowMyPin, I need help with the Studio."), ext: true, w: "help support whatsapp chat contact team call question" });
    if (me().is_admin) list.push({ k: "admin", t: "Admin panel", s: "Dashboard, plans and payments", ic: "admin", c: "v", href: "/admin", w: "admin dashboard panel payments" });
    return list;
  }
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; });

  function run(k, noteEl) {
    if (k === "performance" || k === "pins" || k === "store" || k === "goal" || k === "plans") { closeSheet(); goSection(k); return true; }
    if (k === "profile") { openProfile(); return true; }
    if (k === "logout") {
      fetch("/api/user/logout", { method: "POST", credentials: "same-origin" }).catch(function () {}).then(function () {
        try { document.cookie = "gmp_in=; Max-Age=0; path=/"; } catch (e) {}
        location.href = "/";
      });
      return true;
    }
    if (k === "alerts") {
      if (!window.GMPPush) return true;
      if (noteEl) noteEl.textContent = "Wait";
      window.GMPPush.enable().then(function (r) { if (noteEl) noteEl.textContent = r.message; });
      return true;
    }
    if (k === "install") {
      if (installEvt) { installEvt.prompt(); installEvt = null; if (noteEl) noteEl.textContent = ""; }
      else if (noteEl) {
        var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        noteEl.textContent = ios ? "On iPhone: tap the Share button in Safari, then Add to Home Screen." : "Open the browser menu (three dots) and tap Install app or Add to Home screen.";
      }
      return true;
    }
    return false;
  }

  // ---------------- Search ----------------
  function openSearch() {
    setActive("search");
    sheet("Search", '<div class="sbox">' + I.search + '<input type="search" id="gsQ" placeholder="Search pins, growth, store, plans, help" autocomplete="off" aria-label="Search"></div><div class="rows" id="gsList" role="listbox"></div><p class="note" id="gsNote" aria-live="polite"></p>', function (box) {
      var q = box.querySelector("#gsQ"), list = box.querySelector("#gsList"), note = box.querySelector("#gsNote"), sel = 0, shown = [];
      function hi(text, words) {
        var out = esc(text);
        words.forEach(function (w) { if (w.length > 1) out = out.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
        return out;
      }
      function draw() {
        var v = q.value.trim().toLowerCase(), words = v.split(/\s+/).filter(Boolean);
        var all = actions().filter(function (a) { return a.k !== "connect" || !(me().growth && me().growth.pin_stats); });
        shown = !words.length ? all.slice(0, 7) : all.map(function (a) {
          var hay = (a.t + " " + a.s + " " + a.w).toLowerCase(), score = 0;
          words.forEach(function (w) { if (a.t.toLowerCase().indexOf(w) === 0) score += 5; else if (a.t.toLowerCase().indexOf(w) > -1) score += 3; else if (hay.indexOf(w) > -1) score += 1; else score -= 100; });
          return { a: a, s: score };
        }).filter(function (x) { return x.s > 0; }).sort(function (x, y) { return y.s - x.s; }).map(function (x) { return x.a; });
        if (sel >= shown.length) sel = 0;
        list.innerHTML = (words.length ? "" : '<div class="lbl" style="margin-top:6px">Quick links</div>') + (shown.length ? shown.map(function (a, i) {
          var it = Object.assign({}, a, { bh: hi(a.t, words), sh: hi(a.s, words) });
          return row(it).replace('class="row"', 'class="row' + (i === sel ? " sel" : "") + '" role="option"');
        }).join("") : '<div class="empty">Nothing found for "' + esc(q.value) + '".' + (wa() ? ' <a href="https://wa.me/' + wa() + '?text=' + encodeURIComponent("Hi GrowMyPin, " + q.value) + '" target="_blank" rel="noopener">Ask us on WhatsApp</a>' : "") + '</div>');
      }
      q.addEventListener("input", function () { sel = 0; draw(); });
      q.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
        if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
        if (e.key === "Enter" && shown[sel]) { e.preventDefault(); var el = list.querySelectorAll(".row")[sel]; if (el) el.click(); }
      });
      list.addEventListener("click", function (e) {
        var r = e.target.closest(".row"); if (!r) return;
        var k = r.getAttribute("data-k");
        if (r.tagName === "BUTTON") { e.preventDefault(); run(k, note); }
      });
      draw();
      setTimeout(function () { q.focus(); }, RM ? 0 : 120);
    });
  }

  // ---------------- Profile ----------------
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function openProfile() {
    setActive("profile");
    var m = me(), u = m.user || {};
    var name = u.name || (u.email || "").split("@")[0] || "You";
    sheet("Profile", '<div class="pf"><div class="av" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</div><div><b>' + esc(name) + '</b><span>' + esc(u.email || "") + '</span></div></div>' +
      '<div class="lbl">Your account</div><div class="rows" id="gpRows"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>' +
      '<div class="lbl">Account</div><div class="rows">' + row({ k: "logout", t: "Log out", s: "Sign out of this device", ic: "out", c: "r" }) + '</div>', function (box) {
      box.addEventListener("click", function (e) {
        var r = e.target.closest(".row"); if (!r) return;
        if (r.tagName === "BUTTON") { e.preventDefault(); run(r.getAttribute("data-k")); }
      });
      api("/api/user/me").then(function (full) {
        var g = full.growth || {}, pin = full.pinterest, b = full.billing || {};
        var links = g.links || {}, names = { etsy: "Etsy", shopify: "Shopify", ebay: "eBay" };
        var shops = Object.keys(links).filter(function (k) { return links[k]; });
        var rows = [];
        rows.push(pin ? { k: "pins", t: "Pinterest connected", s: "@" + pin.username + " - tap to see your pins", ic: "pin", c: "r" }
                      : { t: "Connect Pinterest", s: "See your real views, pins and plans", ic: "link", href: "/api/auth/login?next=/home.html" });
        if (b.active) rows.push({ k: "plans", t: b.plan_name + " plan active", s: "Till " + fmtDate(b.plan_until) + " (" + b.days_left + " days left)", ic: "tag", c: "v" });
        else if (pin) rows.push({ k: "plans", t: "No plan yet", s: "Pick a plan and we start growing your account", ic: "tag", c: "v" });
        rows.push({ k: "store", t: shops.length ? shops.map(function (k) { return names[k]; }).join(" + ") + " store" : "Add your store", s: shops.length ? "Tap to change your store links" : "Etsy, Shopify or eBay link", ic: "store", c: "w" });
        rows.push({ k: "goal", t: g.target ? g.target + " sales a month" : "Set your sales goal", s: g.niche ? "You sell: " + g.niche : "Your monthly goal from Pinterest", ic: "goal", c: "v" });
        if (full.user && full.user.whatsapp) rows.push({ k: "", t: "WhatsApp", s: full.user.whatsapp, ic: "chat" });
        var el = box.querySelector("#gpRows");
        if (el) el.innerHTML = rows.map(function (r) { return r.k === "" ? row(r).replace('<button class="row"', '<button class="row" disabled style="cursor:default"').replace(/<span class="go">[\s\S]*?<\/span><\/button>$/, "</button>") : row(r); }).join("");
      }).catch(function () {
        var el = box.querySelector("#gpRows"); if (el) el.innerHTML = '<div class="empty">Could not load your profile. Check your internet.</div>';
      });
    });
  }

  // ---------------- More ----------------
  function openMore() {
    setActive("more");
    var a = actions(), by = {};
    a.forEach(function (x) { by[x.k] = x; });
    var top = ["studio", "plans", "store", "alerts", "install", "wa", "admin"].filter(function (k) { return by[k]; }).map(function (k) { return by[k]; });
    var legal = ["terms", "privacy", "billing", "aup"].map(function (k) { return by[k]; });
    sheet("More", '<div class="tiles">' + top.map(function (x) { return tile({ k: x.k, t: x.t.replace("Turn on notifications", "Notifications").replace("Install the app", "Install app").replace("Help on WhatsApp", "WhatsApp help"), s: { studio: "AI pin drafts", plans: "Start growing", store: "Etsy, Shopify", alerts: "Updates on phone", install: "Home screen", wa: "Talk to us", admin: "Owner tools" }[x.k] || "", ic: x.ic, c: x.c, href: x.href, ext: x.ext }); }).join("") + '</div>' +
      '<p class="note" id="gmNote" aria-live="polite"></p>' +
      '<div class="lbl">Policies</div><div class="rows">' + legal.map(row).join("") + '</div>' +
      '<div class="lbl">Account</div><div class="rows">' + row(by.logout) + '</div>', function (box) {
      box.addEventListener("click", function (e) {
        var t = e.target.closest(".tile, .row"); if (!t || t.tagName === "A") return;
        e.preventDefault();
        run(t.getAttribute("data-k"), box.querySelector("#gmNote"));
      });
    });
  }

  // ---------------- the bar ----------------
  var TABS = [
    { k: "home", t: "Home", ic: "home" },
    { k: "search", t: "Search", ic: "search" },
    { k: "performance", t: "Performance", ic: "perf" },
    { k: "profile", t: "Profile", ic: "user" },
    { k: "more", t: "More", ic: "menu" }
  ];
  var bar = null;
  function currentTab() {
    if (!isHome) return "";
    return perfVisible ? "performance" : "home";
  }
  function setActive(k) {
    if (!bar) return;
    var idx = -1;
    Array.prototype.forEach.call(bar.querySelectorAll("[data-tab]"), function (b, i) {
      var on = b.getAttribute("data-tab") === k;
      b.classList.toggle("on", on);
      if (on) { idx = i; b.setAttribute("aria-current", "page"); } else b.removeAttribute("aria-current");
    });
    var ind = bar.querySelector(".ind");
    ind.style.opacity = idx < 0 ? "0" : "1";
    if (idx > -1) ind.style.transform = "translateX(" + (idx * 100) + "%)";
  }
  var perfVisible = false;
  function mount() {
    if (bar) return;
    bar = document.createElement("nav");
    bar.className = "gnav";
    bar.setAttribute("aria-label", "Main menu");
    bar.innerHTML = '<i class="ind" aria-hidden="true"></i>' + TABS.map(function (t) {
      if (t.k === "home") return '<a href="/home.html" data-tab="home">' + I[t.ic] + '<span>' + t.t + '</span></a>';
      return '<button type="button" data-tab="' + t.k + '" aria-label="' + t.t + '">' + I[t.ic] + '<span>' + t.t + '</span></button>';
    }).join("");
    document.body.appendChild(bar);
    document.body.classList.add("has-gnav");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      var k = b.getAttribute("data-tab");
      if (k === "home") {
        if (isHome) { e.preventDefault(); closeSheet(); window.scrollTo({ top: 0, behavior: RM ? "auto" : "smooth" }); try { history.replaceState(null, "", "/home.html"); } catch (er) {} }
        return;
      }
      if (openSheet && b.classList.contains("on")) { closeSheet(); return; }
      if (k === "search") openSearch();
      if (k === "performance") { closeSheet(); setActive("performance"); goSection("performance"); }
      if (k === "profile") openProfile();
      if (k === "more") openMore();
    });
    setActive(currentTab());
    // on the home page, light up Performance while the growth graph is on screen
    if (isHome && "IntersectionObserver" in window) {
      var tries = 0;
      (function watch() {
        var el = document.getElementById("predCard");
        if (!el) { if (++tries < 40) setTimeout(watch, 200); return; }
        // active while the graph crosses the middle of the screen
        new IntersectionObserver(function (es) {
          perfVisible = es[0].isIntersecting;
          if (!openSheet) setActive(currentTab());
        }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 }).observe(el);
      })();
    }
    // opened from another page: /home.html#performance, #pins, #store, #plans ...
    var h = (location.hash || "").slice(1);
    if (isHome && SECTIONS[h]) goSection(h);
  }

  window.GMPNav = { mount: mount, search: openSearch, profile: openProfile, more: openMore, go: goSection };
  mount();
})();
