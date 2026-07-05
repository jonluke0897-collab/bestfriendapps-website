/* =================================================================
   Best Friend — web breed-match quiz (teaser). Vanilla JS, no deps.
   The matching logic mirrors the app (convex/quiz.ts) over the subset
   of questions asked here, so results are consistent with the app.
   ================================================================= */
(function () {
  "use strict";

  var BREEDS = window.BF_BREEDS || [];
  var APP_STORE = "https://apps.apple.com/app/id6761103192";
  var SHARE_LINK = APP_STORE + "?utm_source=web_quiz&utm_medium=result_share";
  var CTA_LINK = APP_STORE + "?utm_source=web_quiz&utm_medium=result_cta";

  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- Questions (teaser subset of the app's 12) ---------- */
  var QUESTIONS = [
    { id: "species_preference", type: "single", emoji: "🐾", text: "What kind of pet are you looking for?", options: [
      { label: "A dog", value: "dog" }, { label: "A cat", value: "cat" }, { label: "Either — I'm open!", value: "either" } ] },
    { id: "living_space", type: "single", emoji: "🏡", text: "What best describes your home?", options: [
      { label: "Small apartment or condo", value: "apartment_small" }, { label: "Larger apartment or condo", value: "apartment_large" },
      { label: "House with a small yard", value: "house_small_yard" }, { label: "House with a big yard", value: "house_large_yard" } ] },
    { id: "activity_level", type: "single", emoji: "🏃", text: "How active is your daily life?", options: [
      { label: "Mostly relaxed at home", value: "low" }, { label: "Moderately active", value: "moderate" },
      { label: "Very active — daily walks or runs", value: "high" }, { label: "Extremely active — athlete energy", value: "very_high" } ] },
    { id: "hours_home", type: "single", emoji: "🕐", text: "How much are you home each day?", options: [
      { label: "Home most of the day", value: "home_most" }, { label: "Home about half the day", value: "home_half" },
      { label: "Away 6–8 hours", value: "away_moderate" }, { label: "Away most of the day", value: "away_most" } ] },
    { id: "experience_level", type: "single", emoji: "⭐", text: "What's your experience with pets?", options: [
      { label: "First-time owner", value: "none" }, { label: "Had pets growing up", value: "some" },
      { label: "Own or recently owned one", value: "current" }, { label: "Very experienced", value: "experienced" } ] },
    { id: "top_priorities", type: "multi", max: 3, emoji: "💛", text: "What matters most to you?", options: [
      { label: "Affectionate & cuddly", value: "affectionate" }, { label: "Good with kids", value: "good_with_kids" },
      { label: "Easy to train", value: "easy_to_train" }, { label: "Low maintenance", value: "low_maintenance" },
      { label: "Energetic & playful", value: "energetic" }, { label: "Independent", value: "independent" },
      { label: "Good for apartments", value: "apartment_friendly" }, { label: "Low shedding", value: "low_shedding" } ] },
  ];

  var MAPS = {
    space: { apartment_small: 1, apartment_large: 2, house_small_yard: 3, house_large_yard: 5 },
    activity: { low: 1, moderate: 2, high: 4, very_high: 5 },
    hours: { home_most: 5, home_half: 3, away_moderate: 2, away_most: 1 },
    experience: { none: 1, some: 2, current: 3, experienced: 5 },
  };
  var FACTOR_WEIGHTS = { activityLevel: 0.20, spaceNeeded: 0.18, timeCommitment: 0.15, experienceNeeded: 0.13, noiseTolerance: 0.12, groomingEffort: 0.11, budgetLevel: 0.11 };

  var state = { step: 0, answers: {} };
  var mount, resultMount, progBar, progMeta, introStage, flowStage, resultStage;

  /* ---------- Matching (mirrors convex/quiz.ts) ---------- */
  function buildProfile(a) {
    var space = a.living_space, activity = a.activity_level, hours = a.hours_home, exp = a.experience_level;
    var isApartment = space === "apartment_small" || space === "apartment_large";
    return {
      speciesPreference: a.species_preference || "either",
      spaceAvailable: MAPS.space[space] != null ? MAPS.space[space] : 3,
      activityLevel: MAPS.activity[activity] != null ? MAPS.activity[activity] : 2,
      timeAtHome: MAPS.hours[hours] != null ? MAPS.hours[hours] : 3,
      experienceLevel: MAPS.experience[exp] != null ? MAPS.experience[exp] : 2,
      // Not asked in the teaser — neutral defaults so they don't skew results.
      noiseTolerance: 3, groomingWillingness: 3, budgetLevel: 3,
      priorities: a.top_priorities || [],
      requiresApartmentFriendly: isApartment,
      requiresNoviceFriendly: exp === "none",
    };
  }

  function scoreBreed(profile, breed) {
    var cf = breed.compatibilityFactors;
    var user = {
      activityLevel: profile.activityLevel, spaceNeeded: profile.spaceAvailable,
      timeCommitment: profile.timeAtHome, experienceNeeded: profile.experienceLevel,
      noiseTolerance: profile.noiseTolerance, groomingEffort: profile.groomingWillingness,
      budgetLevel: profile.budgetLevel,
    };
    var base = 0, fs = {};
    for (var f in FACTOR_WEIGHTS) {
      var s = 1 - Math.abs(user[f] - cf[f]) / 4;
      fs[f] = s; base += s * FACTOR_WEIGHTS[f];
    }
    var bonus = 0;
    (profile.priorities || []).forEach(function (p) {
      if (p === "affectionate" && (breed.independenceLevel === "velcro" || breed.independenceLevel === "low")) bonus += 0.02;
      else if (p === "good_with_kids" && breed.goodWithKids) bonus += 0.02;
      else if (p === "easy_to_train" && cf.experienceNeeded <= 2) bonus += 0.02;
      else if (p === "low_maintenance" && cf.groomingEffort <= 2 && cf.timeCommitment <= 2) bonus += 0.02;
      else if (p === "energetic" && cf.activityLevel >= 4) bonus += 0.02;
      else if (p === "independent" && (breed.independenceLevel === "high" || breed.independenceLevel === "very_independent")) bonus += 0.02;
      else if (p === "apartment_friendly" && breed.apartmentFriendly) bonus += 0.02;
      else if (p === "low_shedding" && (breed.sheddingLevel === "minimal" || breed.sheddingLevel === "low")) bonus += 0.02;
    });
    return { score: Math.round(Math.min(base + bonus, 1) * 100), fs: fs };
  }

  function reasonsFor(profile, breed, fs) {
    var r = [];
    if (fs.activityLevel >= 0.75) {
      var d = profile.activityLevel <= 2 ? "relaxed" : profile.activityLevel <= 3 ? "moderate" : "active";
      r.push({ s: fs.activityLevel, t: "Matches your " + d + " lifestyle (" + breed.exerciseMinutesPerDay.min + "–" + breed.exerciseMinutesPerDay.max + " min of exercise a day)" });
    }
    if (fs.spaceNeeded >= 0.75) {
      r.push({ s: fs.spaceNeeded, t: (breed.apartmentFriendly && profile.requiresApartmentFriendly) ? "Thrives in apartment living" : "Well-suited to your living space" });
    }
    if (fs.experienceNeeded >= 0.75) {
      r.push({ s: fs.experienceNeeded, t: (breed.noviceFriendly && profile.requiresNoviceFriendly) ? "Great for first-time owners" : "Matches your experience level" });
    }
    if (fs.timeCommitment >= 0.75) r.push({ s: fs.timeCommitment, t: "Fits well with your daily schedule" });
    if (breed.temperament && breed.temperament.length) {
      r.push({ s: 0.5, t: "Known for being " + breed.temperament.slice(0, 2).join(" and ").toLowerCase() });
    }
    return r.sort(function (a, b) { return b.s - a.s; }).slice(0, 3).map(function (x) { return x.t; });
  }

  function computeMatches() {
    var profile = buildProfile(state.answers);
    var pool = BREEDS.slice();
    if (profile.speciesPreference !== "either") pool = pool.filter(function (b) { return b.species === profile.speciesPreference; });
    var filtered = pool.slice();
    if (profile.requiresApartmentFriendly) filtered = filtered.filter(function (b) { return b.apartmentFriendly; });
    if (profile.requiresNoviceFriendly) filtered = filtered.filter(function (b) { return b.noviceFriendly; });
    if (filtered.length < 5) filtered = pool; // relax non-species filters if too narrow
    var scored = filtered.map(function (b) {
      var r = scoreBreed(profile, b);
      return { breed: b, score: r.score, reasons: reasonsFor(profile, b, r.fs) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 4);
  }

  /* ---------- Question rendering ---------- */
  function canProceed(q) {
    var v = state.answers[q.id];
    return q.type === "multi" ? Array.isArray(v) && v.length > 0 : !!v;
  }

  function renderQuestion() {
    var q = QUESTIONS[state.step];
    var total = QUESTIONS.length;
    var sel = state.answers[q.id];

    var opts = q.options.map(function (o) {
      var on = q.type === "multi" ? (Array.isArray(sel) && sel.indexOf(o.value) > -1) : sel === o.value;
      return '<button type="button" class="quiz-option' + (on ? " is-selected" : "") + '" data-value="' + esc(o.value) + '">' +
        '<span class="quiz-option__check">' + CHECK + "</span><span>" + esc(o.label) + "</span></button>";
    }).join("");

    mount.innerHTML =
      '<div class="quiz-card quiz-fade">' +
        '<h2 class="quiz-q__title">' + q.emoji + " " + esc(q.text) + "</h2>" +
        '<div class="quiz-options">' + opts + "</div>" +
        (q.type === "multi" ? '<p class="quiz-hint">Choose up to ' + q.max + "</p>" : "") +
        '<div class="quiz-nav">' +
          (state.step > 0 ? '<button type="button" class="btn btn--ghost" id="qBack">Back</button>' : "") +
          '<button type="button" class="btn btn--primary" id="qNext"' + (canProceed(q) ? "" : " disabled") + ">" +
            (state.step === total - 1 ? "See my match 🎉" : "Next") + "</button>" +
        "</div>" +
      "</div>";

    $$(".quiz-option", mount).forEach(function (btn) {
      btn.addEventListener("click", function () { onSelect(q, btn.getAttribute("data-value")); });
    });
    var nx = $("#qNext", mount); if (nx) nx.addEventListener("click", next);
    var bk = $("#qBack", mount); if (bk) bk.addEventListener("click", back);

    progBar.style.width = ((state.step + 1) / total) * 100 + "%";
    progMeta.firstElementChild.textContent = "Question " + (state.step + 1) + " of " + total;
  }

  function onSelect(q, value) {
    if (q.type === "multi") {
      var arr = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
      var i = arr.indexOf(value);
      if (i > -1) arr.splice(i, 1);
      else { if (arr.length >= q.max) return; arr.push(value); }
      state.answers[q.id] = arr;
    } else {
      state.answers[q.id] = value;
    }
    $$(".quiz-option", mount).forEach(function (btn) {
      var v = btn.getAttribute("data-value");
      var on = q.type === "multi" ? state.answers[q.id].indexOf(v) > -1 : state.answers[q.id] === v;
      btn.classList.toggle("is-selected", on);
    });
    var nx = $("#qNext", mount); if (nx) nx.disabled = !canProceed(q);
  }

  function next() {
    var q = QUESTIONS[state.step];
    if (!canProceed(q)) return;
    if (state.step === QUESTIONS.length - 1) { showResult(); return; }
    state.step++;
    renderQuestion();
    scrollTopSoft();
  }
  function back() {
    if (state.step === 0) return;
    state.step--;
    renderQuestion();
    scrollTopSoft();
  }

  /* ---------- Result ---------- */
  function showResult() {
    var matches = computeMatches();
    if (!matches.length) {
      resultMount.innerHTML = '<div class="quiz-card" style="text-align:center">We couldn\'t load breed data — please refresh and try again.</div>';
    } else {
      renderResult(matches);
    }
    flowStage.hidden = true;
    resultStage.hidden = false;
    scrollTopSoft();
  }

  function renderResult(matches) {
    var top = matches[0];
    var others = matches.slice(1, 4);
    var emoji = top.breed.species === "dog" ? "🐶" : "🐱";

    resultMount.innerHTML =
      '<div class="quiz-fade">' +
        '<div class="result-hero">' +
          '<span class="result-eyebrow">★ Your top match</span>' +
          '<div class="result-ring" style="--pct:' + top.score + '"><div class="result-ring__inner"><div><div class="result-ring__pct">' + top.score + '%</div><div class="result-ring__lbl">match</div></div></div></div>' +
          '<h1 class="result-breed">' + esc(top.breed.name) + " " + emoji + "</h1>" +
          (top.breed.blurb ? '<p class="result-blurb">' + esc(top.breed.blurb) + "</p>" : "") +
          '<div class="result-tags">' + top.breed.temperament.slice(0, 4).map(function (t) { return '<span class="result-tag">' + esc(t) + "</span>"; }).join("") + "</div>" +
        "</div>" +

        '<div class="quiz-card" style="margin-top:16px">' +
          '<div class="result-reasons"><h3>Why you two click</h3>' +
            top.reasons.map(function (t) { return '<div class="result-reason"><span class="result-reason__ic">' + CHECK + "</span><p>" + esc(t) + "</p></div>"; }).join("") +
          "</div>" +
          (others.length ?
            '<div class="result-others"><h3>Other great matches</h3>' +
            others.map(function (m) {
              var e = m.breed.species === "dog" ? "🐶" : "🐱";
              return '<div class="result-other"><div><div class="result-other__name">' + esc(m.breed.name) + " " + e + '</div><div class="result-other__meta">' + esc(cap(m.breed.sizeCategory)) + " " + esc(m.breed.species) + '</div></div><div class="result-other__pct">' + m.score + "%</div></div>";
            }).join("") + "</div>" : "") +
        "</div>" +

        '<div class="result-cta">' +
          "<h3>See your full match — and how to care for them</h3>" +
          "<p>Get every match ranked, save your favourites, and unlock breed-smart daily care in the Best Friend app.</p>" +
          '<div class="result-actions">' +
            '<a class="btn btn--gold btn--lg" href="' + CTA_LINK + '" target="_blank" rel="noopener">Get the app free</a>' +
            '<button type="button" class="btn btn--onink btn--lg" id="qShare">Share result</button>' +
          "</div>" +
        "</div>" +

        '<div style="text-align:center"><button type="button" class="result-restart" id="qRestart">↺ Retake the quiz</button></div>' +
        '<p class="result-foot">This is a quick taster — the full app asks a few more questions for an even sharper match.</p>' +
      "</div>";

    var sh = $("#qShare", resultMount); if (sh) sh.addEventListener("click", function () { shareResult(top); });
    var rs = $("#qRestart", resultMount); if (rs) rs.addEventListener("click", restart);
  }

  function shareResult(top) {
    var emoji = top.breed.species === "dog" ? "🐶" : "🐱";
    var msg = "I'm a " + top.score + "% match with a " + top.breed.name + " " + emoji + " — find your perfect pet with Best Friend!";
    if (navigator.share) {
      navigator.share({ title: "My Best Friend breed match", text: msg, url: SHARE_LINK }).catch(function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg + " " + SHARE_LINK).then(function () { toast("Copied to clipboard!"); }, function () { toast("Couldn't copy"); });
    } else {
      toast("Share: " + SHARE_LINK);
    }
  }

  function restart() {
    state = { step: 0, answers: {} };
    resultStage.hidden = true;
    flowStage.hidden = false;
    renderQuestion();
    scrollTopSoft();
  }

  /* ---------- Helpers ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "quiz-toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    window.clearTimeout(toastEl._t);
    toastEl._t = window.setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }
  function scrollTopSoft() {
    var top = $("#quizTop");
    if (top && top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Init ---------- */
  function init() {
    introStage = $("#quizIntro");
    flowStage = $("#quizFlow");
    resultStage = $("#quizResult");
    mount = $("#quizMount");
    resultMount = $("#quizResultMount");
    progBar = $("#quizProgBar");
    progMeta = $("#quizProgMeta");
    if (!introStage || !flowStage || !mount) return;

    var startBtn = $("#quizStart");
    if (startBtn) startBtn.addEventListener("click", function () {
      introStage.hidden = true;
      flowStage.hidden = false;
      renderQuestion();
      scrollTopSoft();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
