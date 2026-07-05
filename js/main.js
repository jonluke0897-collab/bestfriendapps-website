/* =================================================================
   Best Friend — site interactions (vanilla JS, no dependencies)
   - Sticky header + scroll progress bar
   - Mobile menu
   - Reveal-on-scroll (IntersectionObserver)
   - Count-up stats
   - FAQ accordion
   - Pricing monthly/annual toggle
   All effects respect prefers-reduced-motion.
   ================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- Sticky header + scroll progress (rAF-throttled) ---------- */
  var header = $("#siteHeader");
  var progress = $("#scrollProgress");
  var ticking = false;

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle("scrolled", y > 12);
    if (progress) {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    }
    ticking = false;
  }
  function requestTick() {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }
  window.addEventListener("scroll", requestTick, { passive: true });
  onScroll();

  /* ---------- Mobile menu ---------- */
  var toggle = $("#navToggle");
  var menu = $("#mobileMenu");
  function closeMenu() {
    if (!toggle || !menu) return;
    toggle.classList.remove("open");
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", closeMenu); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = $$(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in-view"); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------- Count-up stats ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = target + suffix; return; }
    var dur = 1500, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  var counters = $$("[data-count]");
  if (counters.length) {
    if (!("IntersectionObserver" in window)) {
      counters.forEach(animateCount);
    } else {
      var countObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { animateCount(entry.target); obs.unobserve(entry.target); }
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* ---------- FAQ accordion ---------- */
  $$(".faq-item__q").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".faq-item");
      var isOpen = item.classList.toggle("open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  });

  /* ---------- Pricing toggle ---------- */
  var billToggle = $("#billToggle");
  var billMonthly = $("#billMonthly");
  var billAnnual = $("#billAnnual");
  var planPrice = $("#planPrice");
  var planPeriod = $("#planPeriod");
  var planNote = $("#planNote");

  var PRICES = {
    monthly: { price: "$9.99", period: "/ month", note: "Billed monthly · cancel anytime" },
    annual:  { price: "$79.99", period: "/ year", note: "Just $6.67/mo, billed annually · cancel anytime" }
  };

  function setBilling(mode) {
    if (!planPrice) return;
    var p = PRICES[mode];
    planPrice.textContent = p.price;
    planPeriod.textContent = p.period;
    planNote.textContent = p.note;
    var annual = mode === "annual";
    if (billToggle) {
      billToggle.classList.toggle("annual", annual);
      billToggle.setAttribute("aria-checked", annual ? "true" : "false");
    }
    if (billMonthly) billMonthly.classList.toggle("active", !annual);
    if (billAnnual) billAnnual.classList.toggle("active", annual);
  }
  if (billToggle) billToggle.addEventListener("click", function () {
    setBilling(billToggle.classList.contains("annual") ? "monthly" : "annual");
  });
  if (billMonthly) billMonthly.addEventListener("click", function () { setBilling("monthly"); });
  if (billAnnual) billAnnual.addEventListener("click", function () { setBilling("annual"); });

  /* ---------- Footer year (keeps copyright current) ---------- */
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
