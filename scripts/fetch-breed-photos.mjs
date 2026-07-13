/* =================================================================
   Best Friend — breed photo fetcher

   TWO MODES
   ---------
   1. FIRST RUN (default): downloads the exact image your app already uses
      (from scripts/breed-illustrations.json), so app + website match.

        node scripts/fetch-breed-photos.mjs

   2. RE-ROLL (--force): fetches a *different* image from the source API.
      Use this on any breed whose photo is a dud.

        node scripts/fetch-breed-photos.mjs --force --only labrador-retriever
        node scripts/fetch-breed-photos.mjs --force --only maltese,siamese,korat

      It remembers every image it has used (assets/breeds/_used.json) and will
      not hand you the same one twice. Keep running it until you're happy.

   Sources: dogs = Dog CEO API, cats = TheCatAPI. Neither needs a key.
   Images are square-cropped to 560px .webp, and js/breed-images.js is
   regenerated automatically.

   SETUP:  npm install sharp
   REVIEW: open assets/breeds/_review.html afterwards
   ================================================================= */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "breeds");
const DATA = path.join(ROOT, "scripts", "breed-illustrations.json");
const USED = path.join(OUT, "_used.json");
const SIZE = 560;

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("\n  Missing dependency:\n\n     npm install sharp\n");
  process.exit(1);
}

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const oi = argv.indexOf("--only");
const ONLY = oi > -1 && argv[oi + 1] ? argv[oi + 1].split(",").map((s) => s.trim()).filter(Boolean) : null;

/* Dog CEO paths. Verified — these are the traps:
     corgi has ONLY a "cardigan" sub-breed; Pembroke is its own top-level entry
     pointer/german and pointer/germanlonghair are DIFFERENT breeds
     the Cavalier lives under "blenheim" (its colour), not under spaniel/cocker */
const DOG_API = {
  "labrador-retriever": "labrador", "golden-retriever": "retriever/golden",
  "german-shepherd": "german/shepherd", bulldog: "bulldog/english",
  poodle: "poodle/standard", beagle: "beagle", rottweiler: "rottweiler",
  dachshund: "dachshund", "cavalier-king-charles-spaniel": "spaniel/blenheim",
  "siberian-husky": "husky", boxer: "boxer", "great-dane": "dane/great",
  "doberman-pinscher": "doberman", "shih-tzu": "shihtzu",
  "australian-shepherd": "australian/shepherd", "yorkshire-terrier": "terrier/yorkshire",
  "bernese-mountain-dog": "mountain/bernese", pomeranian: "pomeranian",
  "french-bulldog": "bulldog/french", havanese: "havanese",
  "cocker-spaniel": "spaniel/cocker", "border-collie": "collie/border",
  chihuahua: "chihuahua", maltese: "maltese", "pembroke-welsh-corgi": "pembroke",
  "boston-terrier": "terrier/boston", akita: "akita",
  "miniature-schnauzer": "schnauzer/miniature", "english-springer-spaniel": "springer/english",
  whippet: "whippet", dalmatian: "dalmatian", samoyed: "samoyed",
  newfoundland: "newfoundland", "saint-bernard": "stbernard",
  "irish-setter": "setter/irish", "basset-hound": "hound/basset",
  "shetland-sheepdog": "sheepdog/shetland", "bichon-frise": "frise/bichon",
  "rhodesian-ridgeback": "ridgeback/rhodesian", "australian-cattle-dog": "cattledog/australian",
  "jack-russell-terrier": "terrier/russell", weimaraner: "weimaraner", vizsla: "vizsla",
  "german-shorthaired-pointer": "pointer/german", "lhasa-apso": "lhasa",
  bloodhound: "hound/blood", papillon: "papillon",
};

const CAT_API = {
  persian: "pers", "maine-coon": "mcoo", ragdoll: "ragd", "british-shorthair": "bsho",
  siamese: "siam", bengal: "beng", abyssinian: "abys", "scottish-fold": "sfol",
  sphynx: "sphy", "russian-blue": "rblu", birman: "birm", "norwegian-forest-cat": "norw",
  "devon-rex": "drex", "oriental-shorthair": "orie", burmese: "bure", savannah: "sava",
  tonkinese: "tonk", manx: "manx", "turkish-angora": "tang", "exotic-shorthair": "esho",
  "american-shorthair": "asho", himalayan: "hima", balinese: "bali", chartreux: "char",
  singapura: "sing", somali: "soma", "japanese-bobtail": "jbob", "cornish-rex": "crex",
  "turkish-van": "tvan", "egyptian-mau": "emau", bombay: "bomb", korat: "kora",
  snowshoe: "snow", "havana-brown": "hbro", "selkirk-rex": "srex",
};

/* Hand-picked and verified. Never touched, not even by --force. */
const HAND_PICKED = new Set([
  "bull-terrier", "cane-corso", "greyhound", "german-shorthaired-pointer",
  "pembroke-welsh-corgi", "cavalier-king-charles-spaniel", "bichon-frise",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "best-friend-site" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* A NEW image for this breed, avoiding any we've used before. */
async function freshURL(breed, used) {
  const seen = new Set(used[breed.slug] || []);
  let pool = [];

  if (breed.species === "dog") {
    const p = DOG_API[breed.slug];
    if (!p) throw new Error("no Dog CEO source for this breed — hand-pick it");
    const d = await getJSON(`https://dog.ceo/api/breed/${p}/images/random/12`);
    if (d.status !== "success") throw new Error("dog.ceo: " + d.status);
    pool = d.message;
  } else {
    const id = CAT_API[breed.slug];
    if (!id) throw new Error("no TheCatAPI source for this breed — hand-pick it");
    const d = await getJSON(`https://api.thecatapi.com/v1/images/search?breed_ids=${id}&limit=25`);
    pool = (d || []).map((x) => x.url).filter(Boolean);
  }

  if (!pool.length) throw new Error("API returned no images");
  const unseen = pool.filter((u) => !seen.has(u));
  // if we've somehow seen them all, start over rather than fail
  return unseen.length ? pick(unseen) : pick(pool);
}

async function save(url, slug) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error("empty file");
  const out = path.join(OUT, `${slug}.webp`);
  await sharp(buf)
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 82 })
    .toFile(out);
  return Math.round((await fs.stat(out)).size / 1024);
}

/* ---------------- run ---------------- */
await fs.mkdir(OUT, { recursive: true });
const breeds = JSON.parse(await fs.readFile(DATA, "utf8"));
const existing = new Set(
  (await fs.readdir(OUT)).filter((f) => f.endsWith(".webp")).map((f) => f.replace(/\.webp$/, ""))
);
let used = {};
try { used = JSON.parse(await fs.readFile(USED, "utf8")); } catch { /* first run */ }

const targets = breeds
  .filter((b) => !HAND_PICKED.has(b.slug))
  .filter((b) => (ONLY ? ONLY.includes(b.slug) : true))
  .filter((b) => (FORCE ? true : !existing.has(b.slug)));

if (ONLY) {
  const unknown = ONLY.filter((s) => !breeds.some((b) => b.slug === s));
  if (unknown.length) console.log(`\n  Unknown slug(s), ignored: ${unknown.join(", ")}`);
  const blocked = ONLY.filter((s) => HAND_PICKED.has(s));
  if (blocked.length) console.log(`  Hand-picked, left alone: ${blocked.join(", ")}`);
}

console.log(`\n  ${FORCE ? "RE-ROLLING" : "Fetching"} ${targets.length} breed photo(s)\n`);

let ok = 0;
const failed = [];

for (const b of targets) {
  try {
    // First run uses the app's stored image. --force always gets a NEW one.
    const url = FORCE ? await freshURL(b, used) : b.illustrationUrl;
    if (!url) throw new Error("no image URL");

    const kb = await save(url, b.slug);
    (used[b.slug] ||= []).push(url);
    existing.add(b.slug);
    ok++;
    console.log(`  OK   ${b.slug.padEnd(28)} ${String(kb).padStart(4)} KB`);
  } catch (e) {
    failed.push(b.slug);
    console.log(`  FAIL ${b.slug.padEnd(28)} ${e.message}`);
  }
  await sleep(150);
}

await fs.writeFile(USED, JSON.stringify(used, null, 1), "utf8");

/* ---- regenerate js/breed-images.js ---- */
const bySlug = Object.fromEntries(breeds.map((b) => [b.slug, b]));
const all = [...existing].filter((s) => bySlug[s]).sort();
const dogs = all.filter((s) => bySlug[s].species === "dog");
const cats = all.filter((s) => bySlug[s].species === "cat");
const q = (L) => L.map((s) => `    "${s}"`).join(",\n");

await fs.writeFile(
  path.join(ROOT, "js", "breed-images.js"),
  `/* =================================================================
   Best Friend — breed photo registry.
   AUTO-GENERATED by scripts/fetch-breed-photos.mjs.
   Breeds not listed fall back to the emoji ring, so nothing breaks.
   ================================================================= */
(function () {
  "use strict";

  var HAVE = [
    // ---- dogs (${dogs.length}) ----
${q(dogs)},

    // ---- cats (${cats.length}) ----
${q(cats)}
  ];

  var set = {};
  HAVE.forEach(function (s) { set[s] = true; });

  window.BF_BREED_IMAGE = function (slug) {
    return set[slug] ? "assets/breeds/" + slug + ".webp" : null;
  };
  window.BF_BREED_IMAGE_COUNT = HAVE.length;
})();
`,
  "utf8"
);

/* ---- contact sheet ---- */
await fs.writeFile(
  path.join(OUT, "_review.html"),
  `<!doctype html><meta charset="utf-8"><title>Breed photos</title>
<style>
 body{font:15px/1.5 system-ui;margin:24px;background:#f7fafb;color:#14333b}
 h1{font-size:20px;margin-bottom:2px} p{color:#5b7179;margin-top:0}
 .g{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-top:22px}
 figure{margin:0;text-align:center}
 img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:50%;border:4px solid #fff;box-shadow:0 2px 10px rgba(20,51,59,.08)}
 figcaption{font-size:12px;margin-top:6px}
 code{background:#e6edee;padding:2px 6px;border-radius:4px;font-size:11px}
</style>
<h1>Breed photos — ${all.length} of ${breeds.length}</h1>
<p>Dud? Re-roll it (you'll get a different image every time):<br>
<code>node scripts/fetch-breed-photos.mjs --force --only SLUG</code></p>
<div class="g">
${all.map((s) => `  <figure><img src="${s}.webp" alt="${s}" loading="lazy"><figcaption>${bySlug[s].name}<br><code>${s}</code></figcaption></figure>`).join("\n")}
</div>
`,
  "utf8"
);

console.log(`\n  ${ok} saved · ${all.length}/${breeds.length} breeds have a photo`);
if (failed.length) console.log(`  Failed: ${failed.join(", ")}`);
const gaps = breeds.filter((b) => !existing.has(b.slug)).map((b) => b.slug);
if (gaps.length) console.log(`  Still missing: ${gaps.join(", ")}`);
console.log(`\n  Review: assets/breeds/_review.html\n`);
