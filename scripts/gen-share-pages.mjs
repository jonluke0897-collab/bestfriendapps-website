/* =================================================================
   Best Friend — social share pages + OG cards

   For every breed that has a photo, generates:
     1. assets/breeds/cards/<slug>.jpg  — a 1200x630 Open Graph card
        (breed photo + branded panel) so Facebook/X/etc. show the match
        instead of a generic Play Store listing.
     2. m/<slug>.html — a lightweight landing page whose <head> points at
        that card, and whose body funnels the visitor into the quiz + app.

   The quiz "Share" button links to m/<slug>.html, so a friend sees the
   breed card, taps through, takes the quiz, and installs — a viral loop.

   Facebook reads STATIC per-breed metadata, so the card can't carry the
   viewer's exact score (that varies per person); the live score is shown
   on the landing page via the ?s= param instead.

   Run:   node scripts/gen-share-pages.mjs
          node scripts/gen-share-pages.mjs --only havanese
   Setup: npm install sharp
   ================================================================= */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://bestfriendapps.com";
const PHOTOS = path.join(ROOT, "assets", "breeds");
const CARDS = path.join(PHOTOS, "cards");
const PAGES = path.join(ROOT, "m");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("\n  Missing dependency:\n\n     npm install sharp\n");
  process.exit(1);
}

const argv = process.argv.slice(2);
const oi = argv.indexOf("--only");
const ONLY = oi > -1 && argv[oi + 1] ? argv[oi + 1].split(",").map((s) => s.trim()).filter(Boolean) : null;

/* ---- load breeds from js/quiz-data.js (window.BF_BREEDS = [...]) ---- */
const dataJs = await fs.readFile(path.join(ROOT, "js", "quiz-data.js"), "utf8");
const match = dataJs.match(/window\.BF_BREEDS\s*=\s*(\[[\s\S]*?\])\s*;/);
if (!match) {
  console.error("Could not find window.BF_BREEDS in js/quiz-data.js");
  process.exit(1);
}
const BREEDS = JSON.parse(match[1]);

/* ---- helpers ---- */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Greedy word-wrap into <=maxLines lines of <=maxChars characters. */
function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines || 3);
}

/* ---- 1200x630 OG card: photo left, branded text panel right ---- */
async function makeCard(b) {
  const W = 1200;
  const H = 630;
  const PW = 630; // photo occupies the left square
  const tx = PW + 58; // text left edge inside the panel

  const photoBuf = await sharp(path.join(PHOTOS, b.slug + ".webp"))
    .resize(PW, H, { fit: "cover", position: "attention" })
    .toBuffer();

  // Auto-size the breed name so long names (e.g. "Cavalier King Charles
  // Spaniel") still fit the ~460px-wide panel.
  const name = b.name;
  let nfs = 68;
  let maxChars = 12;
  if (name.length > 22) {
    nfs = 42;
    maxChars = 19;
  } else if (name.length > 13) {
    nfs = 54;
    maxChars = 15;
  }
  const nameLines = wrap(name, maxChars, 3);
  const nameTop = 232;
  const lineGap = nfs + 8;
  const nameSvg = nameLines
    .map(
      (ln, i) =>
        `<text x="${tx}" y="${nameTop + i * lineGap}" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="800" font-size="${nfs}" fill="#14333b">${esc(ln)}</text>`
    )
    .join("");
  const subY = nameTop + (nameLines.length - 1) * lineGap + 52;
  const species = b.species === "dog" ? "DOG" : "CAT";

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PW}" y="0" width="${W - PW}" height="${H}" fill="#ffffff"/>
    <rect x="${PW}" y="0" width="9" height="${H}" fill="#0e9c8e"/>
    <rect x="${tx}" y="92" width="236" height="46" rx="23" fill="#f59e0b"/>
    <text x="${tx + 118}" y="122" text-anchor="middle" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="800" font-size="23" fill="#ffffff" letter-spacing="1.5">★ TOP MATCH</text>
    ${nameSvg}
    <text x="${tx}" y="${subY}" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="700" font-size="25" fill="#0e9c8e" letter-spacing="4">${species} · BREED MATCH</text>
    <text x="${tx}" y="547" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="800" font-size="31" fill="#14333b">Best Friend</text>
    <text x="${tx}" y="583" font-family="Nunito, 'Segoe UI', Arial, sans-serif" font-weight="700" font-size="22" fill="#92a3aa">Take the free quiz · bestfriendapps.com</text>
  </svg>`;

  await fs.mkdir(CARDS, { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 4, background: "#ffffff" } })
    .composite([
      { input: photoBuf, left: 0, top: 0 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(path.join(CARDS, b.slug + ".jpg"));
}

/* ---- m/<slug>.html landing page ---- */
function pageHtml(b) {
  const emoji = b.species === "dog" ? "🐶" : "🐱";
  const url = `${SITE}/m/${b.slug}.html`;
  const card = `${SITE}/assets/breeds/cards/${b.slug}.jpg`;
  const ogTitle = `I matched with a ${b.name}! ${emoji}`;
  const desc =
    (b.blurb ? b.blurb + " " : "") +
    "Take the free 1-minute breed quiz to find the dog or cat that fits your life.";
  const quizLink = `/quiz.html?utm_source=share&utm_medium=quiz_result&utm_content=${b.slug}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(ogTitle)} | Best Friend</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Best Friend" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${card}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${card}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css" />
  <style>
    .share-wrap { max-width: 560px; margin: 0 auto; padding: 40px 20px 64px; text-align: center; }
    .share-photo { width: 200px; height: 200px; border-radius: 50%; object-fit: cover; margin: 0 auto 22px; display: block; border: 6px solid var(--surface); box-shadow: var(--shadow-md, 0 10px 30px rgba(20,51,59,.14)); background: var(--grad-brand-soft); }
    .share-eyebrow { font-family: var(--font-head); font-weight: 800; color: var(--cyan-deep); letter-spacing: .08em; text-transform: uppercase; font-size: .82rem; }
    .share-title { font-family: var(--font-head); font-weight: 800; color: var(--ink); font-size: clamp(1.7rem, 6vw, 2.4rem); line-height: 1.1; margin: 6px 0 4px; }
    .share-blurb { color: var(--ink-soft); margin: 12px 0 26px; }
    .share-actions { display: flex; flex-direction: column; gap: 12px; }
    .share-foot { color: var(--ink-faint); font-size: .84rem; margin-top: 22px; }
    .share-foot a { color: var(--cyan-deep); }
  </style>
</head>
<body>
  <main class="share-wrap">
    <img class="share-photo" src="/assets/breeds/${b.slug}.webp" alt="${esc(b.name)}"
         onerror="this.style.display='none'" />
    <p class="share-eyebrow" id="eyebrow">A Best Friend breed match</p>
    <h1 class="share-title">${esc(b.name)} ${emoji}</h1>
    <p class="share-blurb">${esc(b.blurb || "A wonderful companion.")}</p>
    <div class="share-actions">
      <a class="btn btn--gold btn--lg" href="${quizLink}">Find your match — take the quiz</a>
      <a class="btn btn--onink btn--lg" data-bf-placement="share_page"
         href="https://play.google.com/store/apps/details?id=com.bestfriendapp.app" target="_blank" rel="noopener">Get the Best Friend app</a>
    </div>
    <p class="share-foot">Which dog or cat breed fits <em>you</em>? <a href="${quizLink}">Take the free 1-minute quiz →</a></p>
  </main>

  <script src="/js/track.js" defer></script>
  <script src="/js/main.js" defer></script>
  <script>
    /* Personalise the eyebrow with the sharer's score if present (?s=88). */
    (function () {
      var m = /[?&]s=(\\d{1,3})/.exec(location.search);
      var s = m ? Math.min(100, parseInt(m[1], 10)) : null;
      if (s) document.getElementById("eyebrow").textContent = "Someone's " + s + "% top match";
    })();
  </script>
</body>
</html>`;
}

/* ---------------- run ---------------- */
const withPhoto = [];
for (const b of BREEDS) {
  try {
    await fs.access(path.join(PHOTOS, b.slug + ".webp"));
    withPhoto.push(b);
  } catch {
    /* no photo — skip (its share falls back to the quiz page) */
  }
}

const targets = withPhoto.filter((b) => (ONLY ? ONLY.includes(b.slug) : true));
await fs.mkdir(PAGES, { recursive: true });

console.log(`\n  Generating ${targets.length} share page(s) + card(s)\n`);
let ok = 0;
const failed = [];
for (const b of targets) {
  try {
    await makeCard(b);
    await fs.writeFile(path.join(PAGES, b.slug + ".html"), pageHtml(b), "utf8");
    ok++;
    console.log(`  OK   ${b.slug}`);
  } catch (e) {
    failed.push(b.slug);
    console.log(`  FAIL ${b.slug} — ${e.message}`);
  }
}

console.log(`\n  ${ok} generated  ·  cards -> assets/breeds/cards/  ·  pages -> m/`);
if (failed.length) console.log(`  Failed: ${failed.join(", ")}`);
const noPhoto = BREEDS.length - withPhoto.length;
if (noPhoto) console.log(`  (${noPhoto} breed(s) without a photo were skipped)`);
console.log("");
