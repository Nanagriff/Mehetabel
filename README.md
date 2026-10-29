# One grain becomes jollof

A single-page portfolio for a chef who also trained in PR and marketing. One grain of rice is
picked up at the top of the page and, as you scroll, becomes a pile, a pot, a plate, a table and a
story. The site is static: no server, no analytics, no cookies, no third-party scripts. Nothing a
visitor types is sent anywhere.

## Quick start

```bash
npm install      # once (needs Node 22)
npm run dev      # local preview at http://localhost:4321
npm run build    # production site in dist/
npm run preview  # serve dist/ locally
```

## Changing the words, numbers and pictures

Everything you see comes from **one file: `src/content/content.json`**. Open it in any text editor,
change the text between the quotes, save, and rebuild. Anything that still says `[TODO]` is a
placeholder that must be replaced before launch. Searching the file for `TODO` finds them all.

A few conventions inside the file:

- `**double asterisks**` around a phrase in a headline make that phrase bold and red.
- `site.url` must be the real domain before building. The sitemap, share links and robots file use it.
- `owner.name` is shown everywhere; set `owner.useBusinessName` to `true` and fill `owner.businessName`
  if she trades under a business name instead.
- `owner.cv` points at the PDF in `public/cv/`. Drop the file in that folder and match the name.
- `owner.sound` turns on the optional sizzle in section 04 (off by default; it only ever plays after a tap).
- `experience.initiallyVisible` is how many roles show before "Show all".
- `play.recipe` is the hidden recipe. Each ingredient has a `hidingPlace`; the places are fixed
  (grain, photo, fire, skill, card, footer), the words are yours.
- `projects[].link` (`{ href, label }`) adds a button to a project card, for a brand or a site
  of its own. `owner.brands` lists her own brands; each is linked from the contact section.
- `projects[].skills` lists skill ids from `skills.kitchen` and `skills.studio`. Opening a project
  lights those skills up in section 11.

Every string is plain text. Quotes inside text need a backslash: `\"like this\"`.

### Photos

1. Put the real images in `src/photos/` (JPEG or PNG, at least the size noted on each placeholder).
2. In `content.json`, change the path from `/placeholders/…svg` to `photos/filename.jpg`.
3. Rebuild. Astro makes AVIF, WebP and JPEG versions at several sizes automatically.

Paths beginning with `/` are served as-is from `public/`; that is how the grey placeholders work.
The hero portrait is preloaded, so keep it under about 300 kB at 1600 px wide.

### Handwriting

`public/handwriting/love.svg` is a stand-in. Replace it with her real handwriting traced as SVG
**paths** with `stroke="currentColor"` and no fill. Each path is drawn on in order as the section
arrives. Any vector tool that exports plain paths works; keep it under 20 paths.

### Favicon, share image and the grain icon

`npm run icons` regenerates `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-512.png`
and the 1200×630 share image `og.jpg` in `public/`, using the name and colours from the content
file. Run it after changing the name, then rebuild.

## Checking before launch

```bash
grep -n TODO src/content/content.json   # anything left here is a placeholder
npm run build                           # must finish without errors
npm run preview                         # open it, scroll to the bottom, try the game
```

Useful while testing: add `?grain=2d` to the URL to see the lightweight version, `?grain=off`
to hide the grain entirely, and `?grain=webgl` to force the full version.

## Deploying

The site is plain files in `dist/`. Any static host works.

- **Netlify**: connect the repo; `netlify.toml` sets the build command and caching headers.
- **Cloudflare Pages**: build command `npm run build`, output directory `dist`, Node version 22.
- **Vercel**: it detects Astro; nothing to configure.
- **GitHub Pages**: `.github/workflows/deploy.yml` builds and publishes on every push to `main`.
  Turn on Pages with source "GitHub Actions" in the repository settings first. For a project page
  under `user.github.io/repo`, also add `base: '/repo'` to `astro.config.mjs`.
- **Your own server**: upload `dist/` and use `deploy/nginx.conf` as the server block.
- **Contabo (current, mauplus-prod)**: `npm run build && ./deploy/push.sh`. The script rsyncs `dist/`,
  `deploy/docker-compose.yml` and `deploy/nginx.container.conf` to `/opt/mehetabel` over the `mauplus`
  SSH alias and runs `docker compose up -d`. An `nginx:alpine` container serves the files on the
  `coolify` network and Coolify's Traefik terminates TLS (Let's Encrypt) for
  `mehetabel.169.58.62.79.sslip.io`. To move to a real domain, point its A record at 169.58.62.79,
  change the two `Host(...)` labels in the compose file and `site.url`, rebuild and push.

Set `site.url` in `content.json` to the final address before the production build.

## How it is built

- **Astro 5** renders the page to static HTML; **vanilla JavaScript** adds the interactions.
  No React, no framework in the browser.
- **The grain** is a WebGL point cloud drawn with [OGL](https://github.com/oframe/ogl) (about 19 kB).
  Every keyframe of the story is stored in a texture and blended on the GPU; the page's main thread
  does no per-particle work. Phones with four cores or less get 3,000 grains instead of 6,000;
  if the frame rate drops, the site switches itself to a 2D canvas with 1,500 grains.
  The ingredient pieces (`src/scripts/grain/sprites.js`) and the pot, plate and table
  (`src/scripts/grain/props.js`) are painted once on a canvas at load and drawn as pictures; edit
  those files to change how they look. The fire under the pot is a small shader (`FIRE_FRAG` in
  `src/scripts/grain/webgl.js`), with a hand-drawn version in the 2D fallback.
- **Without JavaScript** the page reads top to bottom with a short note and a still grain.
- **Reduced motion** (a system setting) freezes every transition on its final frame; the game and
  the slider still work.
- **Fonts** are Fraunces and Source Sans 3, self-hosted from `public/fonts/`.
- **Dark mode** follows the system setting.
- The hidden recipe remembers which ingredients were found in the browser's local storage, nothing else.
  It is the only thing stored.

### Files worth knowing

```
src/content/content.json   every word, number and image path
src/photos/                real photographs go here
src/pages/index.astro      the page, assembling the sections in order
src/components/sections/   one file per numbered section
src/scripts/               interactions, the game, the hidden recipe, the grain
src/styles/global.css      colours, type and layout tokens
public/                    fonts, icons, placeholders, CV, handwriting
scripts/make-icons.mjs     favicon and share image generator
```

## Performance notes

Measured with Lighthouse 12 in headless Chrome using software rendering (no GPU), which makes the
WebGL start-up look much heavier than on a real phone:

| Page | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile, grain off | 96 | 100 | 100 | 100 |
| Mobile, 2D grain | 96 | 100 | 100 | 100 |
| Mobile, WebGL grain | 72 to 75 | 100 | 100 | 100 |
| Desktop, WebGL grain | 71 to 79 | 100 | 100 | 100 |

The gap between the WebGL and 2D rows is almost entirely the browser creating its GPU context
under software rendering (around 450 ms in a cold headless browser). On a device with a GPU that
step takes a few milliseconds. Please check once on a real mid-range Android phone before launch;
if it falls short, set `n` lower in `src/scripts/grain/index.js` or force `?grain=2d` behaviour by
default there.

Total weight excluding photos: about 880 kB on disk, 350 kB over the wire.
# Mehetabel
