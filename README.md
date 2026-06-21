# Best Friend — Website

This is the marketing website for the **Best Friend** app. It's a fast, mobile-friendly static site (plain HTML, CSS and JavaScript) — there's **no build step** and nothing to install. You can open it, edit it, and put it online yourself.

---

## 📂 What's in here

```
Best Friend/
├── index.html        ← the main landing page
├── support.html      ← the support / help page
├── css/styles.css    ← all the styling (colours, fonts, layout)
├── js/main.js        ← the animations and interactions
├── assets/
│   ├── logo/         ← your logo, app icon, and social-share image
│   ├── screens/      ← your app screenshots (already cleaned up)
│   └── img/          ← the dog & cat photos
├── robots.txt        ← helps search engines
└── sitemap.xml       ← helps search engines
```

---

## 👀 Preview it on your computer

Pick whichever is easiest:

**Option 1 — just open it (simplest)**
Double-click `index.html`. It opens in your browser. (Everything works except it's best viewed with one of the options below, which behave exactly like a real web server.)

**Option 2 — VS Code Live Server**
1. Open this folder in VS Code.
2. Install the “Live Server” extension (one time).
3. Right-click `index.html` → **Open with Live Server**.

**Option 3 — one command**
In a terminal opened in this folder:
```
npx serve
```
Then open the address it prints (e.g. `http://localhost:3000`).

---

## ✏️ How to change common things

Open the file in any text editor (even Notepad, but VS Code is nicer) and use Find (Ctrl+F):

| I want to change… | File | Find this |
|---|---|---|
| The App Store link | `index.html` & `support.html` | `id6761103192` |
| The Premium price | `js/main.js` | `PRICES` (top of the pricing section) |
| The contact email | both `.html` files | `thebestfriendapp@gmail.com` |
| The headline | `index.html` | `Find the` |
| Brand colours | `css/styles.css` | the `:root` block at the very top |
| A dog/cat photo | replace the file in `assets/img/` (keep the same filename) | — |
| An app screenshot | replace the file in `assets/screens/` (keep the same filename) | — |

---

## 🌍 Put it online (free)

**Easiest — Netlify Drop**
1. Go to **app.netlify.com/drop**
2. Drag this whole `Best Friend` folder onto the page.
3. Done — it gives you a live link instantly.

**GitHub Pages** (you already use this for your legal pages)
1. Create a new repository on GitHub (e.g. `bestfriend-website`).
2. Upload all the files in this folder to it.
3. In the repo: **Settings → Pages → Source: “Deploy from a branch” → main → /(root)** → Save.
4. Your site appears at `https://<your-username>.github.io/bestfriend-website/`.

**Your own domain (bestfriendapps.com)**
Once it's live on Netlify or GitHub Pages, add the custom domain in that service's settings, then point your domain's DNS to it (both services give you the exact records to add). Reach out if you'd like this walked through click-by-click.

---

## ✅ Worth updating later

- **Real reviews:** the “Why people choose Best Friend” section has a note where your real App Store reviews can go. Once you have a few, they can replace the placeholder.
- **Legal pages:** the Privacy Policy and Cookie Policy are embedded from Termly on `privacy.html` and `cookies.html` (linked in the footers). There's no Terms of Use yet — if you need one, generate it on Termly and we can add a `terms.html` the same way. To swap in updated Termly text later, replace the content between the `Termly … embed` comments on those two pages.
- **Cookie banner (optional):** the pages above are the policy *documents*. If you want the actual consent **pop-up banner**, grab Termly's Consent Management install script (`app.termly.io/resource-blocker/…`) and it gets added to every page's `<head>`. The site sets no tracking cookies of its own, so this is optional.
- **Price:** if you change the App Store price from $5.99/$47.99, update `PRICES` in `js/main.js` to match.

---

## 🎨 Credits

- **Fonts:** Nunito & Quicksand (Google Fonts) — same as the app.
- **Photos:** from Unsplash, free to use under the [Unsplash License](https://unsplash.com/license). Swap them anytime by replacing the files in `assets/img/`.
- **Screenshots & logo:** your own, from the Best Friend app.
