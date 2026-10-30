// GrowMyPin Studio - shared motion + tile helpers (same feel as growmypin.vercel.app)
(function () {
  var reduce = false, fine = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    fine = window.matchMedia("(pointer: fine)").matches;
  } catch (e) {}

  // Tile kinds come from the main site's CSS illustrations (brand.css).
  var TILES = [
    { k: "t-ring", tag: "Jewelry", name: "Engagement rings" },
    { k: "t-arch", tag: "Decor", name: "Bedroom ideas" },
    { k: "t-yarn", tag: "DIY", name: "Crochet patterns" },
    { k: "t-gift", tag: "Gifts", name: "Gifts for her" },
    { k: "t-leaf", tag: "Health", name: "Herbal wellness" },
    { k: "t-dress", tag: "Fashion", name: "Wedding guest" },
    { k: "t-cup", tag: "Wellness", name: "Herbal tea" }
  ];

  // Real pin photos for the landing board (Admin > Banners > Landing page pins can change them).
  var SHOWCASE = [
    { image: "/showcase/ring.jpg", title: "Oval moissanite engagement ring gift idea for her", name: "Engagement rings", tag: "Jewelry" },
    { image: "/showcase/runner.jpg", title: "Luxury hand-tufted stair runner for a grand entrance", name: "Stair runner", tag: "Home decor" },
    { image: "/showcase/bracelet.jpg", title: "Minimalist silver bracelet, an everyday gift for her", name: "Silver bracelet", tag: "Jewelry" },
    { image: "/showcase/poster.jpg", title: "Virat Kohli framed wall poster for cricket fans", name: "Wall art", tag: "Gifts" },
    { image: "/showcase/haircare.jpg", title: "Natural hair care routine for stronger, shinier hair", name: "Hair care", tag: "Wellness" },
    { image: "/showcase/crochet.jpg", title: "Adorable crochet deer amigurumi pattern PDF", name: "Crochet patterns", tag: "DIY" }
  ];
  (function () {
    var st = document.createElement("style");
    st.textContent = ".t-photo .art{background:#EEF0F5}.t-photo .art img,.tilefill.t-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}";
    document.head.appendChild(st);
  })();
  function photoTile(item) {
    var w = document.createElement("div");
    w.className = "tilefill t-photo";
    var im = document.createElement("img");
    im.src = item.image; im.alt = ""; im.decoding = "async";
    w.appendChild(im);
    return w;
  }
  function photoPin(item, h) {
    var p = document.createElement("div");
    p.className = "pin t-photo";
    var a = document.createElement("div");
    a.className = "art";
    a.style.setProperty("--h", (h || 220) + "px");
    var im = document.createElement("img");
    im.src = item.image; im.alt = ""; im.loading = "lazy"; im.decoding = "async";
    a.appendChild(im);
    p.appendChild(a);
    var cap = document.createElement("div");
    cap.className = "cap";
    var b = document.createElement("b");
    b.textContent = item.name || "Pin";
    cap.appendChild(b);
    if (item.tag) { var tg = document.createElement("i"); tg.textContent = item.tag; cap.appendChild(tg); }
    p.appendChild(cap);
    return p;
  }

  // A tile that fills its parent (for previews, cards, modal piles).
  function tile(i) {
    if (i && typeof i === "object" && i.image) return photoTile(i);
    var t = TILES[Math.abs(i || 0) % TILES.length];
    var w = document.createElement("div");
    w.className = "tilefill " + t.k;
    var a = document.createElement("div");
    a.className = "art";
    w.appendChild(a);
    return w;
  }

  // A full board pin with caption (for rising columns).
  function pin(i, h) {
    var t = TILES[Math.abs(i) % TILES.length];
    var p = document.createElement("div");
    p.className = "pin " + t.k;
    var a = document.createElement("div");
    a.className = "art";
    a.style.setProperty("--h", (h || 200) + "px");
    p.appendChild(a);
    var cap = document.createElement("div");
    cap.className = "cap";
    var b = document.createElement("b");
    b.textContent = t.name;
    var tg = document.createElement("i");
    tg.textContent = t.tag;
    cap.appendChild(b);
    cap.appendChild(tg);
    p.appendChild(cap);
    return p;
  }

  // A navy / green / lavender text pin like the main site's t-text tiles.
  function textPin(kicker, line, tone, h) {
    var p = document.createElement("div");
    p.className = "pin t-text" + (tone ? " " + tone : "");
    var a = document.createElement("div");
    a.className = "art";
    a.style.setProperty("--h", (h || 170) + "px");
    var sm = document.createElement("small");
    sm.textContent = kicker;
    var st = document.createElement("strong");
    st.textContent = line;
    a.appendChild(sm);
    a.appendChild(st);
    p.appendChild(a);
    var cap = document.createElement("div");
    cap.className = "cap";
    var b = document.createElement("b");
    b.textContent = "Pin draft";
    var tg = document.createElement("i");
    tg.textContent = "Guide";
    cap.appendChild(b);
    cap.appendChild(tg);
    p.appendChild(cap);
    return p;
  }

  // Fill a .board with 3 rising columns of real pin photos (content duplicated for a seamless loop).
  function fillPhotoBoard(board, items) {
    var list = items && items.length ? items : SHOWCASE;
    var hs = [[250, 210, 270, 230], [230, 270, 200, 250], [270, 220, 250, 210]];
    board.innerHTML = "";
    var n = list.length;
    for (var c = 0; c < 3; c++) {
      var col = document.createElement("div");
      col.className = "col";
      var tr = document.createElement("div");
      tr.className = "track";
      var picks = [];
      for (var k = 0; k < 4; k++) picks.push(list[(c * 2 + k) % n]);
      for (var rep = 0; rep < 2; rep++) {
        for (var j = 0; j < 4; j++) tr.appendChild(photoPin(picks[j], hs[c][j]));
      }
      col.appendChild(tr);
      board.appendChild(col);
    }
  }

  function fillBoard(board, seed) {
    var hs = [[230, 170, 200, 190], [250, 180, 160, 220], [190, 240, 170, 200]];
    var texts = [
      ["Home decor", "12 cozy fall decor ideas for small spaces", ""],
      ["Holiday season", "The cozy holiday gift guide", "green"],
      ["Handmade", "Easy crochet gifts you can make this weekend", "lav"]
    ];
    for (var c = 0; c < 3; c++) {
      var col = document.createElement("div");
      col.className = "col";
      var tr = document.createElement("div");
      tr.className = "track";
      for (var rep = 0; rep < 2; rep++) {
        for (var k = 0; k < 4; k++) {
          if (k === 1) tr.appendChild(textPin(texts[c][0], texts[c][1], texts[c][2], hs[c][k]));
          else tr.appendChild(pin((seed || 0) + c * 2 + k, hs[c][k]));
        }
      }
      col.appendChild(tr);
      board.appendChild(col);
    }
  }

  function countUp(el, to, ms, format) {
    var target = Number(to) || 0;
    var f = format || function (v) { return Math.round(v).toLocaleString("en-IN"); };
    if (reduce || target === 0) { el.textContent = f(target); return; }
    var start = null, dur = ms || 1400;
    var token = {};
    el._cu = token;
    function step(t) {
      if (el._cu !== token) return;
      if (!start) start = t;
      var k = Math.min(1, (t - start) / dur);
      el.textContent = f(target * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function onView(el, fn, threshold) {
    if (!el) return;
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { fn(); io.disconnect(); } });
    }, { threshold: threshold || 0.3 });
    io.observe(el);
  }

  // Typing word (".rot") cycling through niches, like the main site hero.
  function typeWords(el, words) {
    if (!el) return;
    var wi = 0;
    function next() {
      var target = words[wi % words.length]; wi++;
      if (reduce) { el.textContent = target; setTimeout(next, 2600); return; }
      var cur = el.textContent;
      (function del() {
        if (cur.length) { cur = cur.slice(0, -1); el.textContent = cur; setTimeout(del, 38); return; }
        var n = 0;
        (function typ() {
          n++; el.textContent = target.slice(0, n);
          if (n < target.length) setTimeout(typ, 75); else setTimeout(next, 2200);
        })();
      })();
    }
    setTimeout(next, 2400);
  }

  function initMotion() {
    // scroll progress bar
    var prog = document.getElementById("prog");
    var ticking = false;
    function onScroll() {
      ticking = false;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (prog) prog.style.setProperty("--p", h > 0 ? Math.min(1, window.scrollY / h) : 0);
      var sticky = document.getElementById("stickyCta");
      var hero = document.getElementById("hero");
      var fin = document.getElementById("start");
      if (sticky && hero && fin) {
        var past = hero.getBoundingClientRect().bottom < 0;
        var atEnd = fin.getBoundingClientRect().top < window.innerHeight * 0.8;
        sticky.classList.toggle("show", past && !atEnd);
      }
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    // reveal on scroll
    var rv = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!reduce && "IntersectionObserver" in window) {
      rv.forEach(function (el) { el.classList.add("pre"); });
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); }
        });
      }, { threshold: 0.15 });
      rv.forEach(function (el) { io.observe(el); });
    }

    if (reduce || !fine) return;

    // 3D tilt on any pin board
    var bw = document.querySelectorAll(".board-wrap");
    Array.prototype.forEach.call(bw, function (w) {
      var board = w.querySelector(".board");
      if (!board) return;
      w.addEventListener("pointermove", function (e) {
        var r = w.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        board.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
        board.style.setProperty("--rx", (-y * 8).toFixed(2) + "deg");
      });
      w.addEventListener("pointerleave", function () {
        board.style.setProperty("--ry", "0deg");
        board.style.setProperty("--rx", "0deg");
      });
    });

    // glow that follows the cursor on cards
    document.addEventListener("pointermove", function (e) {
      var c = e.target.closest && e.target.closest(".card, .policy, .dcard, .glass");
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
    });

    // magnetic primary buttons
    Array.prototype.forEach.call(document.querySelectorAll(".btn-primary.magnet"), function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.18, y = (e.clientY - r.top - r.height / 2) * 0.28;
        b.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      b.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  window.GMP = {
    reduce: reduce, fine: fine, TILES: TILES, tile: tile, pin: pin, textPin: textPin,
    fillBoard: fillBoard, fillPhotoBoard: fillPhotoBoard, SHOWCASE: SHOWCASE, photoTile: photoTile,
    countUp: countUp, onView: onView, typeWords: typeWords
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initMotion);
  else initMotion();
})();
