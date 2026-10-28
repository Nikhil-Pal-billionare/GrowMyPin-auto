// GrowMyPin Studio - growth forecast engine + animated chart.
// Everything the model assumes lives in the CONFIG block below, so it can be tuned
// with real results from GrowMyPin client accounts over time.
(function () {
  // ===================== CONFIG (tune these with real data) =====================

  // Strategies the Studio can run.
  // growth: multiplier on expected 90 day reach, ctr: multiplier on outbound click rate,
  // spread: how wide the best/worst range is (higher = riskier, bigger upside).
  var STRATEGIES = [
    { id: "trend", name: "Trend wave", short: "80% seasonal trends, 20% evergreen pins. Rides what people search this month.", growth: 1.25, ctr: 1.0, spread: 1.35 },
    { id: "gift", name: "Gift angle", short: "Gift-recipient pins: gifts for mom, for her, for him. Strong buying intent.", growth: 1.12, ctr: 1.35, spread: 1.15 },
    { id: "evergreen", name: "Evergreen SEO", short: "Keyword-led pins that keep ranking for months. Slow start, steady climb.", growth: 1.0, ctr: 1.1, spread: 0.85 },
    { id: "hook", name: "Curiosity hooks", short: "Big readable text hooks that stop the scroll. High reach, more swing.", growth: 1.2, ctr: 1.15, spread: 1.5 },
    { id: "lifestyle", name: "Lifestyle glow", short: "Warm, glowing lifestyle scenes around the product. Great for decor and jewelry.", growth: 1.1, ctr: 0.95, spread: 1.1 }
  ];

  // Typical daily impressions after ~90 days at 2 pins a day, and typical outbound click rate.
  var NICHES = {
    "Home Decor": { base: 2000, ctr: 0.009 },
    "Jewelry": { base: 1100, ctr: 0.011 },
    "Engagement Rings": { base: 1000, ctr: 0.012 },
    "Fashion": { base: 2300, ctr: 0.008 },
    "Health and Wellness": { base: 900, ctr: 0.01 },
    "Digital Products": { base: 1300, ctr: 0.013 },
    "Crafts and Patterns": { base: 1700, ctr: 0.012 },
    "Other": { base: 1200, ctr: 0.009 }
  };

  // Target countries. weight = relative size of the Pinterest audience for these sellers.
  var COUNTRIES = [
    { code: "US", name: "United States", weight: 1 },
    { code: "CA", name: "Canada", weight: 0.18 },
    { code: "GB", name: "United Kingdom", weight: 0.22 },
    { code: "AU", name: "Australia", weight: 0.14, south: true },
    { code: "DE", name: "Germany", weight: 0.12 },
    { code: "FR", name: "France", weight: 0.1 },
    { code: "IN", name: "India", weight: 0.12 },
    { code: "NZ", name: "New Zealand", weight: 0.04, south: true },
    { code: "IE", name: "Ireland", weight: 0.04 },
    { code: "AE", name: "United Arab Emirates", weight: 0.04 },
    { code: "NL", name: "Netherlands", weight: 0.05 },
    { code: "MX", name: "Mexico", weight: 0.08 }
  ];

  var HORIZON = 90; // days forecast ahead (3 months minimum)

  // ===================== helpers =====================
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function byId(id) {
    for (var i = 0; i < STRATEGIES.length; i++) if (STRATEGIES[i].id === id) return STRATEGIES[i];
    return STRATEGIES[0];
  }
  function country(code) {
    for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].code === code) return COUNTRIES[i];
    return null;
  }
  function fmt(n) {
    n = Math.max(0, Number(n) || 0);
    if (n < 1000) return String(Math.round(n));
    if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
    return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dlabel(d) { return MONTHS[d.getMonth()] + " " + d.getDate(); }

  function marketFactor(codes) {
    var sum = 0;
    (codes || []).forEach(function (c) { var x = country(c); if (x) sum += x.weight; });
    if (sum <= 0) sum = 1;
    return Math.pow(sum, 0.5);
  }

  function smooth7(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var s = 0, n = 0;
      for (var j = Math.max(0, i - 6); j <= i; j++) { s += arr[j]; n++; }
      out.push(s / n);
    }
    return out;
  }

  // log-linear trend on the last part of the (smoothed) history
  function trend(sm) {
    var take = sm.slice(-Math.min(sm.length, 45));
    var n = take.length;
    if (n < 14) return null;
    var xs = [], ys = [];
    for (var i = 0; i < n; i++) { xs.push(i); ys.push(Math.log(take[i] + 5)); }
    var mx = 0, my = 0;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var sxx = 0, sxy = 0;
    for (i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    var k = sxy / sxx;
    var res = 0;
    for (i = 0; i < n; i++) { var e = ys[i] - (my + k * (xs[i] - mx)); res += e * e; }
    var se = Math.sqrt(res / Math.max(1, n - 2)) / Math.sqrt(sxx);
    return { k: k, se: se };
  }

  // ===================== forecast =====================
  // opts: { history: [daily impressions, oldest first], niche, strategy, pinsPerDay, countries, perf }
  function forecast(opts) {
    var S = byId(opts.strategy);
    var N = NICHES[opts.niche] || NICHES.Other;
    var hist = (opts.history || []).map(function (v) { return Math.max(0, Number(v) || 0); });
    var sm = smooth7(hist);
    var n = hist.length;
    var b0 = n ? sm[n - 1] : 0;
    var hasData = n >= 21 && b0 >= 15;

    var cadence = Math.pow(clamp(opts.pinsPerDay || 2, 0.5, 15) / 2, 0.55);
    var market = marketFactor(opts.countries);
    var perf = clamp(opts.perf || 1, 0.5, 1.8);
    var prior = N.base * S.growth * cadence * market * perf;

    var target, spread = S.spread, start;
    if (hasData) {
      var t = trend(sm);
      var k = t ? clamp(t.k, -0.012, 0.035) : 0;
      var trendTarget = b0 * Math.exp(k * HORIZON * 0.6) * Math.pow(S.growth, 0.6) * Math.pow(cadence, 0.6);
      var w = clamp(n / 90, 0.35, 0.8);
      target = Math.exp(w * Math.log(Math.max(trendTarget, 1)) + (1 - w) * Math.log(Math.max(prior, b0 * 0.8, 1)));
      spread = S.spread * clamp(1 + (t ? t.se : 0.01) * 25, 0.85, 1.6) * (1 - 0.35 * w);
      start = b0;
    } else {
      target = prior;
      start = opts.fromZero ? 0 : Math.max(b0, prior * 0.03);
    }

    var best = target * (1 + 0.95 * spread);
    var worst = target / (1 + 1.35 * spread);
    worst = Math.max(worst, start * 0.6);
    if (worst > target) worst = target * 0.85;

    var delay = hasData ? 0 : 14; // new accounts are quiet for ~2 weeks
    var shape = hasData ? 1.15 : 1.7;
    function path(tgt) {
      var out = [];
      for (var d = 0; d <= HORIZON; d++) {
        var f;
        if (d === 0) f = 0;
        else if (d <= delay) f = 0.04 * d / delay;
        else f = 0.04 + 0.96 * Math.pow((d - delay) / (HORIZON - delay), shape);
        out.push(start + (tgt - start) * f);
      }
      return out;
    }
    var pa = path(target), pb = path(best), pw = path(worst);

    function last30(a) { var s = 0; for (var i = a.length - 30; i < a.length; i++) s += a[i]; return s; }
    var now30 = 0;
    for (var i = Math.max(0, n - 30); i < n; i++) now30 += hist[i];
    var ctr = N.ctr * S.ctr;

    return {
      strategy: S, hasData: hasData,
      history: hist, smooth: sm,
      avg: pa, best: pb, worst: pw,
      summary: {
        now30: now30,
        worst30: last30(pw), avg30: last30(pa), best30: last30(pb),
        clicksWorst30: last30(pw) * ctr, clicksAvg30: last30(pa) * ctr, clicksBest30: last30(pb) * ctr,
        ctr: ctr
      }
    };
  }

  // Which strategy should run now. actuals: { stratId: { pins, impressions, clicks } }
  function autoPick(niche, date, actuals) {
    date = date || new Date();
    if (actuals) {
      var bestId = null, bestRate = 0, total = 0, totalPins = 0;
      Object.keys(actuals).forEach(function (id) {
        var a = actuals[id];
        total += a.impressions; totalPins += a.pins;
        if (a.pins >= 3) {
          var rate = a.impressions / a.pins;
          if (rate > bestRate) { bestRate = rate; bestId = id; }
        }
      });
      var avgRate = totalPins ? total / totalPins : 0;
      if (bestId && avgRate && bestRate >= avgRate * 1.2) {
        return { id: bestId, reason: byId(bestId).name + " is getting your best results so far: " + fmt(bestRate) + " impressions per pin." };
      }
    }
    var m = date.getMonth(), day = date.getDate();
    var giftNiche = niche === "Jewelry" || niche === "Engagement Rings";
    if ((m >= 8 && m <= 10) || (m === 11 && day <= 20)) {
      if (giftNiche) return { id: "gift", reason: "Holiday gift searches peak from October to mid December, and jewelry gift pins get the most outbound clicks." };
      if (niche === "Health and Wellness") return { id: "gift", reason: "Self-care gift sets do well in the holiday season, so gift framing gets more clicks right now." };
      if (niche === "Digital Products") return { id: "evergreen", reason: "Digital products rank best on steady keywords, and holiday noise makes trend pins harder to win." };
      return { id: "trend", reason: "Pinterest holiday trends run 6 to 8 weeks ahead of Google, so seasonal pins posted now catch the peak." };
    }
    if ((m === 11 && day > 20) || m === 0) {
      if (niche === "Health and Wellness" || niche === "Home Decor") return { id: "trend", reason: "New Year fresh-start and organizing searches jump from late December to mid January." };
      return { id: "evergreen", reason: "After Christmas, holiday searches drop fast. Evergreen keywords keep pins ranking." };
    }
    if (m === 1) return { id: "gift", reason: "Valentine's Day gift searches lead February." };
    if (m >= 2 && m <= 4) return { id: niche === "Home Decor" ? "lifestyle" : "trend", reason: "Spring refresh and Mother's Day planning drive searches from March to May." };
    return { id: "evergreen", reason: "Summer is a building season. Evergreen pins now grow into the autumn and holiday peak." };
  }

  function suggestAudience(niche, product, codes, date) {
    date = date || new Date();
    var names = (codes || ["US"]).map(function (c) { var x = country(c); return x ? (c === "US" ? "the US" : x.name) : c; });
    var where = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    var m = date.getMonth();
    var holiday = (m >= 9 && m <= 10) || (m === 11 && date.getDate() <= 20);
    var p = String(product || "").trim().toLowerCase();
    var map = {
      "Jewelry": "Women 22 to 44 in " + where + " saving jewelry ideas and outfit inspiration" + (holiday ? ", many of them planning holiday gifts" : ""),
      "Engagement Rings": "Couples 24 to 35 in " + where + " planning a proposal or wedding and saving ring ideas",
      "Home Decor": "Homeowners and renters 25 to 45 in " + where + " decorating living rooms and bedrooms" + (holiday ? " for the holidays" : ""),
      "Fashion": "Women 18 to 35 in " + where + " saving outfit ideas for the season",
      "Health and Wellness": "Adults 25 to 50 in " + where + " interested in natural wellness, herbal teas and self-care routines",
      "Digital Products": "Creators and small business owners 22 to 40 in " + where + " looking for templates and digital tools",
      "Crafts and Patterns": "Crafters 25 to 55 in " + where + " looking for crochet and DIY patterns to make at home",
      "Other": "Shoppers 25 to 45 in " + where + " browsing Pinterest for ideas" + (p ? " around " + p : "")
    };
    return map[niche] || map.Other;
  }

  // ===================== chart =====================
  // GMPForecast.chart(container, result, { histDays, animate, quick, startDate })
  function chart(container, r, opts) {
    opts = opts || {};
    var narrow = (container.clientWidth || 760) < 600;
    var W = narrow ? 470 : 760, H = narrow ? 380 : 330, L = narrow ? 42 : 50, R = narrow ? 92 : 96, T = 24, B = 40;
    var histDays = Math.min(narrow ? 21 : (opts.histDays || 45), r.smooth.length);
    container._fc = { r: r, opts: opts, narrow: narrow };
    container.classList.toggle("narrow", narrow);
    var hist = r.smooth.slice(r.smooth.length - histDays);
    var today = opts.today || new Date();
    var HZ = r.avg.length - 1;
    var xMin = histDays ? -histDays : -Math.round(HZ / 18), xMax = HZ;
    var yMax = Math.max(10, Math.max.apply(null, r.best.concat(hist))) * 1.12;
    function X(d) { return L + (d - xMin) / (xMax - xMin) * (W - L - R); }
    function Y(v) { return T + (1 - v / yMax) * (H - T - B); }
    function line(arr, offset) {
      var s = "";
      for (var i = 0; i < arr.length; i++) s += (i ? " L" : "M") + X(i + offset).toFixed(1) + " " + Y(arr[i]).toFixed(1);
      return s;
    }
    var hOff = -histDays + 1;
    var NS = "http://www.w3.org/2000/svg";
    var uid = "fc" + Math.random().toString(36).slice(2, 7);

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Forecast of daily impressions with worst, average and best case">';
    svg += '<defs><linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14B88F" stop-opacity=".22"/><stop offset="1" stop-color="#14B88F" stop-opacity="0"/></linearGradient>';
    svg += '<linearGradient id="' + uid + 'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24292F" stop-opacity=".12"/><stop offset="1" stop-color="#24292F" stop-opacity="0"/></linearGradient>';
    svg += '<clipPath id="' + uid + 'ch"><rect class="fc-clip-h" x="' + L + '" y="0" width="' + (opts.quick ? (X(0) - L + 2) : 0) + '" height="' + H + '"/></clipPath>';
    svg += '<clipPath id="' + uid + 'cf"><rect class="fc-clip-f" x="' + X(0) + '" y="0" width="0" height="' + H + '"/></clipPath></defs>';

    // grid + y labels
    for (var g = 0; g <= 4; g++) {
      var gv = yMax * g / 4;
      svg += '<line class="fc-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(gv) + '" y2="' + Y(gv) + '"/>';
      svg += '<text class="fc-lbl" x="' + (L - 8) + '" y="' + (Y(gv) + 4) + '" text-anchor="end">' + fmt(gv) + '</text>';
    }
    // forecast zone tint
    svg += '<rect class="fc-zone" x="' + X(0) + '" y="' + T + '" width="' + (X(HZ) - X(0)) + '" height="' + (H - T - B) + '"/>';
    // x ticks
    var ticks = [];
    if (histDays >= 30 && !narrow) ticks.push(-30);
    var step = (narrow && HZ > 120) ? 60 : 30;
    for (var tk = 0; tk <= HZ; tk += step) ticks.push(tk);
    ticks.forEach(function (d) {
      var lbl = d === 0 ? "Today" : dlabel(addDays(today, d));
      svg += '<text class="fc-lbl' + (d === 0 ? ' fc-today-lbl' : '') + '" x="' + X(d) + '" y="' + (H - 14) + '" text-anchor="middle">' + lbl + '</text>';
      if (d > 0) svg += '<text class="fc-month" x="' + X(d) + '" y="' + (H - 1) + '" text-anchor="middle">Month ' + (d / 30) + '</text>';
    });

    // history
    svg += '<g clip-path="url(#' + uid + 'ch)">';
    if (hist.length > 1) {
      svg += '<path class="fc-hist-area" fill="url(#' + uid + 'h)" d="' + line(hist, hOff) + ' L' + X(0) + ' ' + Y(0) + ' L' + X(hOff) + ' ' + Y(0) + ' Z"/>';
      svg += '<path class="fc-hist" d="' + line(hist, hOff) + '"/>';
    }
    svg += '</g>';

    // forecast
    var band = line(r.best, 0);
    for (var i = r.worst.length - 1; i >= 0; i--) band += " L" + X(i).toFixed(1) + " " + Y(r.worst[i]).toFixed(1);
    svg += '<g clip-path="url(#' + uid + 'cf)">';
    svg += '<path class="fc-band" fill="url(#' + uid + 'g)" d="' + band + ' Z"/>';
    svg += '<path class="fc-best" d="' + line(r.best, 0) + '"/>';
    svg += '<path class="fc-worst" d="' + line(r.worst, 0) + '"/>';
    svg += '<path class="fc-avg" d="' + line(r.avg, 0) + '"/>';
    svg += '</g>';

    // today marker
    var t0 = r.avg[0];
    svg += '<line class="fc-today-line" x1="' + X(0) + '" x2="' + X(0) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
    svg += '<g transform="translate(' + X(0) + ' ' + Y(t0) + ')"><g class="fc-dot"><circle class="fc-pulse" r="7"/><circle class="fc-core" r="6"/></g></g>';
    var tagW = 104, tagX = Math.min(X(0) + 10, W - R - tagW), tagY = Math.max(T + 2, Y(t0) - 38);
    var tagTxt = opts.nowLabel || ("Now " + fmt(t0) + "/day");
    svg += '<g class="fc-tag" transform="translate(' + tagX + ' ' + tagY + ')"><rect width="' + tagW + '" height="24" rx="12"/><text x="' + (tagW / 2) + '" y="16" text-anchor="middle">' + tagTxt + '</text></g>';

    // end labels (spaced so they never overlap)
    var ends = [
      { cls: "best", txt: "Best " + fmt(r.best[HZ]), y: Y(r.best[HZ]) },
      { cls: "avg", txt: "Avg " + fmt(r.avg[HZ]), y: Y(r.avg[HZ]) },
      { cls: "worst", txt: "Worst " + fmt(r.worst[HZ]), y: Y(r.worst[HZ]) }
    ];
    for (var e = 1; e < ends.length; e++) if (ends[e].y < ends[e - 1].y + 24) ends[e].y = ends[e - 1].y + 24;
    ends.forEach(function (en) {
      svg += '<g class="fc-end fc-end-' + en.cls + '" transform="translate(' + (W - R + 8) + ' ' + (en.y - 11) + ')"><rect width="86" height="22" rx="11"/><text x="43" y="15" text-anchor="middle">' + en.txt + '</text></g>';
    });

    // hover
    svg += '<line class="fc-hover-line" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" style="opacity:0"/>';
    svg += '<rect class="fc-hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/>';
    svg += '</svg><div class="fc-tip" style="opacity:0"></div>';

    container.innerHTML = svg;
    var root = container.querySelector("svg");
    var clipH = root.querySelector(".fc-clip-h");
    var clipF = root.querySelector(".fc-clip-f");
    var fullH = X(0) - L + 2, fullF = X(HZ) - X(0) + 2;
    var reduce = window.GMP && window.GMP.reduce;

    function anim(el, to, ms, done) {
      if (reduce || ms === 0) { el.setAttribute("width", to); if (done) done(); return; }
      var s = null;
      function step(t) {
        if (!s) s = t;
        var k = Math.min(1, (t - s) / ms);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        el.setAttribute("width", (to * e).toFixed(1));
        if (k < 1) requestAnimationFrame(step); else if (done) done();
      }
      requestAnimationFrame(step);
    }
    container.classList.remove("fc-in", "fc-done");
    void container.offsetWidth;
    if (opts.animate === false) {
      clipH.setAttribute("width", fullH); clipF.setAttribute("width", fullF);
      container.classList.add("fc-in", "fc-done");
    } else if (opts.quick) {
      clipH.setAttribute("width", fullH);
      container.classList.add("fc-in");
      anim(clipF, fullF, 900, function () { container.classList.add("fc-done"); });
    } else if (hist.length <= 1) {
      clipH.setAttribute("width", fullH);
      container.classList.add("fc-in");
      anim(clipF, fullF, 1700, function () { container.classList.add("fc-done"); });
    } else {
      anim(clipH, fullH, 1300, function () {
        container.classList.add("fc-in");
        setTimeout(function () { anim(clipF, fullF, 1500, function () { container.classList.add("fc-done"); }); }, 350);
      });
    }

    // tooltip
    var tip = container.querySelector(".fc-tip");
    var hl = root.querySelector(".fc-hover-line");
    var hit = root.querySelector(".fc-hit");
    function move(ev) {
      var b = root.getBoundingClientRect();
      var sx = (ev.clientX - b.left) / b.width * W;
      var d = Math.round(xMin + (sx - L) / (W - L - R) * (xMax - xMin));
      d = clamp(d, hOff, HZ);
      var x = X(d);
      hl.setAttribute("x1", x); hl.setAttribute("x2", x); hl.style.opacity = 1;
      var html;
      var date = dlabel(addDays(today, d));
      if (d <= 0) {
        var v = hist[hist.length - 1 + d];
        html = "<b>" + (d === 0 ? "Today" : date) + "</b><span>Actual " + fmt(v) + "/day</span>";
      } else {
        html = "<b>" + date + "</b><span class='b'>Best " + fmt(r.best[d]) + "</span><span class='a'>Avg " + fmt(r.avg[d]) + "</span><span class='w'>Worst " + fmt(r.worst[d]) + "</span>";
      }
      tip.innerHTML = html;
      var px = x / W * b.width;
      tip.style.left = clamp(px, 70, b.width - 70) + "px";
      tip.style.opacity = 1;
    }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", function () { tip.style.opacity = 0; hl.style.opacity = 0; });
  }

  // Build a chart result from monthly view totals (for example from an AI report).
  // months: [{worst, avg, best}, ...] total views per month. startDaily: views/day today.
  function fromMonthly(months, startDaily, histDaily, horizonDays) {
    var n = months.length;
    var days = Math.min(horizonDays || n * 30, n * 30);
    function series(key) {
      var xs = [0], ys = [Math.max(0, startDaily || 0)];
      for (var i = 0; i < n; i++) { xs.push(15 + i * 30); ys.push(Math.max(0, months[i][key] / 30)); }
      var lastSlope = n > 1 ? (ys[n] - ys[n - 1]) / 30 : 0;
      xs.push(n * 30); ys.push(Math.max(0, ys[n] + lastSlope * 15));
      // monotone cubic interpolation (no overshoot)
      var m = xs.length, d = [], t = [];
      for (var k = 0; k < m - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
      t.push(d[0]);
      for (k = 1; k < m - 1; k++) t.push(d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2);
      t.push(d[m - 2]);
      for (k = 0; k < m - 1; k++) {
        if (d[k] === 0) { t[k] = 0; t[k + 1] = 0; continue; }
        var a = t[k] / d[k], b = t[k + 1] / d[k], h = a * a + b * b;
        if (h > 9) { var q = 3 / Math.sqrt(h); t[k] = q * a * d[k]; t[k + 1] = q * b * d[k]; }
      }
      var out = [], seg = 0;
      for (var x = 0; x <= days; x++) {
        while (seg < m - 2 && x > xs[seg + 1]) seg++;
        var x0 = xs[seg], x1 = xs[seg + 1], hh = x1 - x0, u = (x - x0) / hh;
        var h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
        out.push(Math.max(0, h00 * ys[seg] + h10 * hh * t[seg] + h01 * ys[seg + 1] + h11 * hh * t[seg + 1]));
      }
      return out;
    }
    var hist = (histDaily || []).map(function (v) { return Math.max(0, Number(v) || 0); });
    return { strategy: null, hasData: hist.length > 0, history: hist, smooth: smooth7(hist), avg: series("avg"), best: series("best"), worst: series("worst"), summary: {} };
  }

  // Re-draw charts (without animation) when the layout crosses the phone breakpoint.
  var rsT = null;
  window.addEventListener("resize", function () {
    clearTimeout(rsT);
    rsT = setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll(".fc"), function (c) {
        if (!c._fc) return;
        var nowNarrow = c.clientWidth < 600;
        if (nowNarrow !== c._fc.narrow) {
          var o = {}; for (var k in c._fc.opts) o[k] = c._fc.opts[k];
          o.animate = false; o.quick = false;
          chart(c, c._fc.r, o);
        }
      });
    }, 200);
  });

  // Sample 60-day history for demos (a young account that is starting to take off).
  function sampleHistory(seed) {
    var out = [], s = seed || 7;
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < 60; i++) {
      var base = i < 18 ? 20 + i * 2 : 56 * Math.exp((i - 18) * 0.045);
      var weekly = 1 + 0.12 * Math.sin(i / 7 * Math.PI * 2);
      out.push(Math.round(base * weekly * (0.85 + rnd() * 0.3)));
    }
    return out;
  }

  window.GMPForecast = {
    STRATEGIES: STRATEGIES, NICHES: NICHES, COUNTRIES: COUNTRIES, HORIZON: HORIZON,
    byId: byId, country: country, fmt: fmt,
    forecast: forecast, autoPick: autoPick, suggestAudience: suggestAudience,
    chart: chart, sampleHistory: sampleHistory, fromMonthly: fromMonthly
  };
})();
