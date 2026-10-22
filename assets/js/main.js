/* Hans Gas and Heating — site interactions */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header: scrolled state + hide on scroll down ---------- */
  var header = $(".site-header");
  var mbar = $(".mbar");
  var lastY = window.scrollY;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 24);
      var menuOpen = document.body.classList.contains("menu-open");
      header.classList.toggle("is-hidden", !menuOpen && y > 480 && y > lastY + 2);
      if (y < lastY - 2) header.classList.remove("is-hidden");
    }
    if (mbar) mbar.classList.toggle("is-visible", y > 420);
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var menu = $(".m-menu");
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("menu-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  }
  $$("[data-menu-open]").forEach(function (b) { b.addEventListener("click", function () { setMenu(true); }); });
  $$("[data-menu-close]").forEach(function (b) { b.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });

  /* ---------- Split headings into masked lines ---------- */
  $$("[data-split]").forEach(function (el) {
    var parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts.map(function (p, i) {
      return '<span class="split-line" style="--d:' + (i * 0.09 + (parseFloat(el.dataset.delay) || 0)) + 's"><span>' + p.trim() + "</span></span>";
    }).join("");
  });

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = $$("[data-reveal], [data-split], .steps, .split-line.is-manual");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Statement: words light up while scrolling ---------- */
  $$(".js-scrub").forEach(function (el) {
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
            var s = document.createElement("span"); s.className = "w"; s.textContent = t; frag.appendChild(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains("pill-img")) {
          walk(n);
        }
      });
    };
    walk(el);
    el.classList.add("is-split");
    var words = $$(".w", el);
    var update = function () {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
      p = Math.max(0, Math.min(1, p));
      var lit = Math.round(p * words.length);
      words.forEach(function (w, i) { w.classList.toggle("is-lit", i < lit); });
    };
    if (reduceMotion) { words.forEach(function (w) { w.classList.add("is-lit"); }); return; }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ---------- Counters ---------- */
  var counters = $$("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, end = parseFloat(el.dataset.count), t0 = null, dur = 1800;
        cio.unobserve(el);
        if (reduceMotion) { el.textContent = end; return; }
        var tick = function (t) {
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / dur);
          el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4)));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  }

  /* ---------- Comfort dial (hero) ---------- */
  var dialRoot = $("[data-dial-root]");
  var dial = $(".dial");
  if (dialRoot && dial) {
    var MIN = 16, MAX = 28, R = 118, C = 2 * Math.PI * R, ARC = C * 0.75;
    var prog = $(".dial__progress", dial), knob = $(".dial__knob", dial);
    var tempEl = $("[data-dial-temp]"), statusEl = $("[data-dial-status]"), humEl = $("[data-dial-hum]"), sysEl = $("[data-dial-sys]");
    var ticks = $(".dial__ticks", dial);
    var state = { mode: "heat", temp: { heat: 22, cool: 21 } };
    var interacted = false;

    // ticks
    for (var i = 0; i <= 48; i++) {
      var a = (135 + (i / 48) * 270) * Math.PI / 180, long = i % 6 === 0;
      var r1 = 136, r2 = long ? 146 : 141;
      var l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", 150 + r1 * Math.cos(a)); l.setAttribute("y1", 150 + r1 * Math.sin(a));
      l.setAttribute("x2", 150 + r2 * Math.cos(a)); l.setAttribute("y2", 150 + r2 * Math.sin(a));
      if (long) l.style.stroke = "rgba(255,255,255,.45)";
      ticks.appendChild(l);
    }

    var render = function () {
      var t = state.temp[state.mode];
      var f = (t - MIN) / (MAX - MIN);
      prog.setAttribute("stroke-dasharray", (f * ARC).toFixed(2) + " " + C.toFixed(2));
      prog.setAttribute("stroke", state.mode === "heat" ? "url(#gHeat)" : "url(#gCool)");
      var ang = (135 + f * 270) * Math.PI / 180;
      knob.setAttribute("cx", (150 + R * Math.cos(ang)).toFixed(2));
      knob.setAttribute("cy", (150 + R * Math.sin(ang)).toFixed(2));
      tempEl.textContent = t;
      statusEl.innerHTML = (state.mode === "heat" ? "Heating to " : "Cooling to ") + "<b>" + t + "°C</b>";
      humEl.textContent = state.mode === "heat" ? "41%" : "47%";
      sysEl.textContent = state.mode === "heat" ? "Furnace" : "Heat pump";
      dial.setAttribute("aria-valuenow", t);
      dial.setAttribute("aria-valuetext", t + " degrees, " + (state.mode === "heat" ? "heating" : "cooling"));
    };
    var setMode = function (m) {
      state.mode = m;
      dialRoot.setAttribute("data-mode", m);
      $$("[data-set-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.setMode === m ? "true" : "false"); });
      render();
    };
    var setTemp = function (t) {
      state.temp[state.mode] = Math.max(MIN, Math.min(MAX, Math.round(t)));
      render();
    };
    var stopDemo = function () { interacted = true; };

    $$("[data-set-mode]").forEach(function (b) {
      b.addEventListener("click", function () { stopDemo(); setMode(b.dataset.setMode); });
    });
    $$("[data-dial-step]").forEach(function (b) {
      b.addEventListener("click", function () { stopDemo(); setTemp(state.temp[state.mode] + parseFloat(b.dataset.dialStep)); });
    });
    dial.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); stopDemo(); setTemp(state.temp[state.mode] + 1); }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); stopDemo(); setTemp(state.temp[state.mode] - 1); }
    });

    var dragging = false;
    var fromPointer = function (e) {
      var r = dial.getBoundingClientRect();
      var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      var deg = Math.atan2(y, x) * 180 / Math.PI;
      var a = (deg - 135 + 720) % 360;
      if (a > 270) a = a > 315 ? 0 : 270;
      setTemp(MIN + (a / 270) * (MAX - MIN));
    };
    dial.addEventListener("pointerdown", function (e) { dragging = true; stopDemo(); dial.setPointerCapture(e.pointerId); fromPointer(e); });
    dial.addEventListener("pointermove", function (e) { if (dragging) fromPointer(e); });
    dial.addEventListener("pointerup", function () { dragging = false; });
    dial.addEventListener("pointercancel", function () { dragging = false; });

    // intro sweep, then gently alternate modes until the visitor takes over
    render();
    if (!reduceMotion) {
      var target = state.temp.heat; state.temp.heat = MIN; render();
      setTimeout(function () {
        var t = MIN;
        var sweep = setInterval(function () {
          if (interacted) { clearInterval(sweep); return; }
          t++; setTemp(t);
          if (t >= target) clearInterval(sweep);
        }, 70);
      }, 900);
      setInterval(function () {
        if (interacted || document.hidden) return;
        var r = dialRoot.getBoundingClientRect();
        if (r.bottom < 0) return;
        setMode(state.mode === "heat" ? "cool" : "heat");
      }, 6500);
    }
  }

  /* ---------- Comfort finder ---------- */
  var finder = $("[data-finder]");
  if (finder) {
    var RESULTS = {
      cold: { title: "Reliable <em>heat</em>, all winter long.", text: "Cold rooms, a tired furnace or rising gas bills usually point to a repair, a tune-up or a high-efficiency replacement. We'll find the cause before recommending anything.", services: ["Furnaces", "Heat Pumps"] },
      hot: { title: "Cool, quiet <em>summers</em>.", text: "Whether it's a central air conditioner or an all-season heat pump, we'll size the system to your home so it cools evenly without running non-stop.", services: ["Air Conditioning", "Heat Pumps"] },
      air: { title: "Fresh air in <em>every room</em>.", text: "Stuffiness, lingering odours and window condensation are classic signs of poor ventilation. An HRV brings in fresh air while holding on to the heat you've paid for.", services: ["HRV Systems", "Ventilation"] },
      water: { title: "Hot water, <em>on demand</em>.", text: "From leaking tanks to lukewarm showers, we repair and replace hot water tanks and help you decide whether tank or tankless suits your household.", services: ["Hot Water Tanks"] },
      gas: { title: "Safe, certified <em>gas work</em>.", text: "New lines for a range, BBQ, patio heater or fireplace, done safely and to code by a licensed gas fitter.", services: ["Gas Fitting", "Fireplaces"] },
      upgrade: { title: "An upgrade that <em>pays you back</em>.", text: "Renovating or building? We'll plan heating, cooling and ventilation together so everything works as one efficient system.", services: ["Heat Pumps", "Furnaces", "HRV Systems"] }
    };
    var HOME_NOTES = {
      house: "",
      town: " In townhouses we pay close attention to equipment placement and noise for you and your neighbours.",
      condo: " In condos and apartments, compact ductless equipment is often the cleanest fit, and we'll check strata requirements with you.",
      older: " Older and character homes often lack space for full-size ducts, which is exactly where compact Hi-Velocity systems shine."
    };
    var HOME_LABELS = { house: "Detached house", town: "Townhouse or duplex", condo: "Condo or apartment", older: "Older or character home" };
    var ICONS = { "Furnaces": "i-flame", "Heat Pumps": "i-heatpump", "Air Conditioning": "i-snow", "HRV Systems": "i-hrv", "Ventilation": "i-wind", "Hot Water Tanks": "i-tank", "Gas Fitting": "i-gas", "Fireplaces": "i-fireplace", "Hi-Velocity Systems": "i-velocity" };
    var pick = { issue: null, home: null };
    var steps = $$(".f-step", finder), marks = $$("[data-finder-mark]");

    var go = function (n) {
      steps.forEach(function (s, i) { s.classList.toggle("is-active", i === n); });
      marks.forEach(function (m, i) { m.classList.toggle("is-active", i === n); m.classList.toggle("is-done", i < n); });
    };
    var showResult = function () {
      var r = RESULTS[pick.issue];
      var services = r.services.slice();
      if (pick.home === "older" && (pick.issue === "cold" || pick.issue === "hot" || pick.issue === "upgrade") && services.indexOf("Hi-Velocity Systems") < 0) services.unshift("Hi-Velocity Systems");
      $("[data-result-title]", finder).innerHTML = r.title;
      $("[data-result-text]", finder).textContent = r.text + HOME_NOTES[pick.home];
      $("[data-result-list]", finder).innerHTML = services.map(function (s) {
        return '<span><svg class="icon"><use href="#' + ICONS[s] + '"/></svg>' + s + "</span>";
      }).join("");
      $("[data-result-book]", finder).href = "contact.html?service=" + encodeURIComponent(services.join(",")) + "&home=" + encodeURIComponent(HOME_LABELS[pick.home]);
      $("[data-result-learn]", finder).href = "services.html#" + services[0].toLowerCase().replace(/[^a-z]+/g, "-");
      go(2);
    };
    $$("[data-issue]", finder).forEach(function (b) { b.addEventListener("click", function () { pick.issue = b.dataset.issue; go(1); }); });
    $$("[data-home]", finder).forEach(function (b) { b.addEventListener("click", function () { pick.home = b.dataset.home; showResult(); }); });
    $$("[data-finder-back]", finder).forEach(function (b) { b.addEventListener("click", function () { go(Math.max(0, parseInt(b.dataset.finderBack, 10))); }); });
    go(0);
  }

  /* ---------- Service area map: sync list & dots ---------- */
  $$("[data-city]").forEach(function (el) {
    var name = el.dataset.city;
    var toggle = function (on) { $$('[data-city="' + name + '"]').forEach(function (x) { x.classList.toggle("is-hot", on); }); };
    el.addEventListener("mouseenter", function () { toggle(true); });
    el.addEventListener("mouseleave", function () { toggle(false); });
  });

  /* ---------- Services: filters + scrollspy ---------- */
  var chips = $$("[data-filter]");
  if (chips.length) {
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) { c.classList.toggle("is-active", c === chip); c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        $$(".svc").forEach(function (s) {
          var show = f === "all" || s.dataset.cat.split(" ").indexOf(f) > -1;
          s.hidden = !show;
          var link = $('.svc-index a[href="#' + s.id + '"]');
          if (link) link.parentElement.hidden = !show;
        });
        var first = $(".svc:not([hidden])");
        if (first && window.scrollY > first.getBoundingClientRect().top + window.scrollY) first.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }
  var svcs = $$(".svc");
  if (svcs.length && "IntersectionObserver" in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$(".svc-index a").forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    svcs.forEach(function (s) { sio.observe(s); });
  }

  /* ---------- Comfort calendar: place "today" ---------- */
  var now = $(".calendar__now");
  if (now) {
    var d = new Date();
    var pos = (d.getMonth() + (d.getDate() - 1) / 31 + 0.5) / 12 * 100;
    now.style.left = Math.min(98, pos) + "%";
    var m = d.getMonth();
    var season = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "fall" : "winter";
    var card = $('.season[data-season="' + season + '"]');
    if (card) card.classList.add("is-now");
  }

  /* ---------- Contact form ---------- */
  var form = $("[data-contact-form]");
  if (form) {
    var params = new URLSearchParams(window.location.search);
    var pre = (params.get("service") || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    $$('input[name="service"]', form).forEach(function (cb) { if (pre.indexOf(cb.value.toLowerCase()) > -1) cb.checked = true; });
    var home = params.get("home");
    if (home) $$('input[name="home"]', form).forEach(function (r) { if (r.value === home) r.checked = true; });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      $$("[required]", form).forEach(function (f) {
        var bad = !f.value.trim() || (f.type === "email" && f.value && !/^\S+@\S+\.\S+$/.test(f.value));
        f.classList.toggle("is-invalid", bad);
        if (bad && ok) { f.focus(); ok = false; }
      });
      if (!ok) return;
      var val = function (n) { var el = form.elements[n]; return el ? el.value.trim() : ""; };
      var services = $$('input[name="service"]:checked', form).map(function (c) { return c.value; });
      var homeSel = $('input[name="home"]:checked', form);
      var pref = $('input[name="contact_pref"]:checked', form);
      var lines = [
        "Name: " + val("name"),
        "Phone: " + val("phone"),
        "Email: " + (val("email") || "-"),
        "City: " + (val("city") || "-"),
        "Property: " + (homeSel ? homeSel.value : "-"),
        "Services: " + (services.join(", ") || "-"),
        "Preferred contact: " + (pref ? pref.value : "-"),
        "",
        val("message")
      ];
      var to = form.dataset.to;
      var href = "mailto:" + to + "?subject=" + encodeURIComponent("Service request from " + val("name")) + "&body=" + encodeURIComponent(lines.join("\n"));
      window.location.href = href;
      var cardEl = form.closest(".form-card");
      cardEl.classList.add("is-sent");
      var nameOut = $("[data-sent-name]");
      if (nameOut) nameOut.textContent = val("name").split(" ")[0];
      cardEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
    $$("[required]", form).forEach(function (f) { f.addEventListener("input", function () { f.classList.remove("is-invalid"); }); });
    var again = $("[data-form-reset]");
    if (again) again.addEventListener("click", function () { form.reset(); form.closest(".form-card").classList.remove("is-sent"); });
  }

  /* ---------- Year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
