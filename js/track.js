/* =================================================================
   Best Friend: attribution + TikTok pixel events.

   Solves three things:
     1. UTMs from an inbound ad/creator link are captured and kept for
        the whole session (they survive index.html -> quiz.html).
     2. Every Google Play link carries a `referrer` payload, so Play
        Console can tell you WHICH creator / hook / campaign drove the
        install. Without this, every install looks identical.
     3. The quiz funnel fires real pixel events, not just a PageView,
        so TikTok can actually optimise delivery.

   Load this BEFORE main.js and quiz.js. No dependencies.

   Funnel:  PageView -> ViewContent (quiz start)
                     -> CompleteRegistration (result shown)
                     -> Download (Play Store click)
   ================================================================= */
(function (window, document) {
  "use strict";

  /* ---------------- Google Analytics 4 ----------------
     Injected here rather than in each page <head> so every page that loads
     track.js -- including the generated m/<slug>.html share pages -- reports
     to GA4 with zero extra markup. Termly's auto-blocker gates it on consent,
     exactly like the TikTok pixel. */
  var GA4_ID = "G-MSJTM8MJQG";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  gtag("js", new Date());
  gtag("config", GA4_ID);
  (function () {
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
    document.head.appendChild(s);
  })();

  var PACKAGE = "com.bestfriendapp.app";
  var PLAY_BASE = "https://play.google.com/store/apps/details?id=" + PACKAGE;
  var STORAGE_KEY = "bf_attribution";

  /* UTM keys we care about. utm_content is the important one; that's
     where the hook/format ID lives (e.g. utm_content=hook03). */
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

  /* ---------------- Attribution capture ---------------- */

  function readQuery() {
    var out = {};
    var q = window.location.search;
    if (!q || q.length < 2) return out;
    q.slice(1).split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i));
      var v = i < 0 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      if (k) out[k] = v;
    });
    return out;
  }

  function load() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function save(obj) {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  /* First touch wins: if this session already has attribution, keep it.
     Otherwise capture from the URL. A visitor who lands on index.html
     from TikTok and then clicks through to the quiz keeps hook03. */
  function resolveAttribution() {
    var stored = load();
    var query = readQuery();
    var fresh = {};
    var hasFresh = false;

    UTM_KEYS.forEach(function (k) {
      if (query[k]) { fresh[k] = query[k]; hasFresh = true; }
    });
    /* TikTok click ID; lets you match a click to a conversion later. */
    if (query.ttclid) { fresh.ttclid = query.ttclid; hasFresh = true; }

    if (hasFresh) { save(fresh); return fresh; }
    if (stored) return stored;
    return {};
  }

  var attribution = resolveAttribution();

  /* ---------------- Google Play links ---------------- */

  /* Play Console reads install attribution out of the `referrer` param.
     It must be a single URL-encoded query string. This is the entire
     reason you can tell hook03 from hook27 in the install numbers. */
  function buildReferrer(placement) {
    var parts = [];
    var src = attribution.utm_source || "website";
    var med = attribution.utm_medium || "organic";

    parts.push("utm_source=" + encodeURIComponent(src));
    parts.push("utm_medium=" + encodeURIComponent(med));
    if (attribution.utm_campaign) parts.push("utm_campaign=" + encodeURIComponent(attribution.utm_campaign));
    if (attribution.utm_content) parts.push("utm_content=" + encodeURIComponent(attribution.utm_content));
    if (attribution.utm_term) parts.push("utm_term=" + encodeURIComponent(attribution.utm_term));
    /* Where on the site they clicked, so you can separate a nav-bar
       download from a quiz-result download. */
    if (placement) parts.push("bf_placement=" + encodeURIComponent(placement));

    return parts.join("&");
  }

  function playUrl(placement) {
    return PLAY_BASE + "&referrer=" + encodeURIComponent(buildReferrer(placement));
  }

  /* Rewrite every Play Store link on the page to carry attribution.
     Safe to call repeatedly; re-run it after injecting new markup
     (the quiz result screen does exactly that). */
  function decorateStoreLinks(root) {
    var scope = root || document;
    var links = scope.querySelectorAll('a[href*="play.google.com"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-bf-decorated") === "1") continue;
      var placement = a.getAttribute("data-bf-placement") || inferPlacement(a);
      a.setAttribute("href", playUrl(placement));
      a.setAttribute("data-bf-placement", placement);
      a.setAttribute("data-bf-decorated", "1");
    }
  }

  /* Best-effort label for links that don't declare a placement. */
  function inferPlacement(a) {
    if (a.closest) {
      if (a.closest(".result-cta")) return "quiz_result_cta";
      if (a.closest(".site-header")) return "nav";
      if (a.closest(".mobile-menu")) return "mobile_menu";
      if (a.closest(".site-footer")) return "footer";
      if (a.closest(".pricing")) return "pricing";
    }
    return "page";
  }

  /* ---------------- Pixel events ---------------- */

  /* Guarded: Termly's auto-blocker may hold the pixel until the visitor
     consents, so window.ttq can legitimately be undefined. Never throw. */
  function track(event, props) {
    var payload = props || {};
    /* Attach the hook/format ID to every event so reporting can be sliced
       by creative, not just by campaign. */
    if (attribution.utm_content) payload.content_id = attribution.utm_content;
    if (window.ttq && typeof window.ttq.track === "function") {
      try { window.ttq.track(event, payload); } catch (e) {}
    }
    if (typeof window.gtag === "function") {
      try { window.gtag("event", event, payload); } catch (e) {}
    }
  }

  /* One delegated listener on the document catches Play Store links that
     were injected AFTER page load, which is precisely the quiz result
     CTA, the single most valuable click on the site, and the one the old
     DOMContentLoaded-bound handler in main.js silently missed. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href*="play.google.com"]') : null;
    if (!a) return;

    /* If this link appeared after the last decorate pass, fix it now,
       before the browser follows it. */
    if (a.getAttribute("data-bf-decorated") !== "1") decorateStoreLinks(a.parentNode || document);

    track("Download", {
      content_type: "product",
      content_name: "Google Play: " + (a.getAttribute("data-bf-placement") || "page"),
    });
  }, true);

  document.addEventListener("DOMContentLoaded", function () { decorateStoreLinks(); });

  /* ---------------- Public API ---------------- */

  window.BF = window.BF || {};
  window.BF.attribution = attribution;
  window.BF.playUrl = playUrl;
  window.BF.decorateStoreLinks = decorateStoreLinks;
  window.BF.track = track;
})(window, document);
