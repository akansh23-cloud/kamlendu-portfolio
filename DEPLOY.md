# Deploying

The build is a plain static bundle — `index.html`, one CSS file, two JS chunks
and a folder of self-hosted font files. No server, no runtime, no environment
variables, no API keys. Anything that can serve a directory can host it.

---

## Before the first deploy

1. **Fill in the two blanks.** Open `src/data/portfolio.js` and search for
   `NEEDS_SOURCE`. Supply `profile.linkedin` and `profile.tenure`, or leave them
   empty — the interface hides what it has no data for and will not render a
   dead button.
2. **Add the CV.** Put the PDF at `public/Kamlendu_Kumar_Resume.pdf`. If it is
   absent, the résumé button deletes itself at runtime rather than 404-ing.
3. **Check it locally.**
   ```bash
   npm ci
   npm test
   npm run build
   npm run preview
   ```

---

## Vercel

`vercel.json` is included and already sets long-lived immutable caching for the
hashed asset folder plus a few sane security headers.

```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production
```

Or connect the Git repository in the Vercel dashboard and accept the detected
settings — build command `npm run build`, output directory `dist`.

---

## Netlify

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

Or add a `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## GitHub Pages

`vite.config.js` sets `base: './'`, so the build works from a subdirectory
without any further configuration — which is exactly the thing that usually
breaks a Pages deploy.

```yaml
# .github/workflows/deploy.yml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

---

## Cloudflare Pages, S3, Nginx, anything else

Build command `npm run build`, publish directory `dist`. For a bare static host:

```bash
npm run build
rsync -av --delete dist/ user@host:/var/www/portfolio/
```

There is no client-side router, so **no SPA rewrite rule is needed**. Deep links
like `/#lakehouse` are hash fragments, which never reach the server.

---

## Caching

Vite fingerprints every asset filename, so the whole `assets/` folder can be
cached permanently and only `index.html` needs to stay fresh:

```
/assets/*     Cache-Control: public, max-age=31536000, immutable
/index.html   Cache-Control: public, max-age=0, must-revalidate
```

three.js is split into its own chunk deliberately. It is the large half of the
bundle and it almost never changes, so a future edit to a scene invalidates
roughly 45 kB of cache instead of all 650 kB.

---

## Expected build output

```
dist/assets/three-*.js     ~510 kB   (~128 kB gzipped)  — cached forever
dist/assets/index-*.js     ~213 kB   (~69 kB gzipped)   — site + six exercises
dist/assets/index-*.css     ~31 kB   (~6.7 kB gzipped)
dist/assets/*.woff2                                     — self-hosted fonts
```

The six era exercises add roughly 22 kB gzipped and no assets at all — they are
drawn to a 2D canvas with no images, no sprite sheets and no audio files.

Fonts are subset per language range by `@fontsource`, so a Latin-only visitor
downloads a small fraction of what is in the folder.

---

## Troubleshooting

**Blank page after deploy, console shows a 404 for a `.js` file.**
The host is serving from a subdirectory and `base` was changed. Put it back to
`'./'` in `vite.config.js`.

**Fonts do not load, everything falls back to a system sans.**
The `@fontsource` packages are in `devDependencies` and the host ran
`npm ci --omit=dev`. Either drop the flag or move the three font packages into
`dependencies`.

**The résumé button is missing.**
Working as intended — `public/Kamlendu_Kumar_Resume.pdf` is not there. The
button is removed at runtime by a `HEAD` request rather than left to fail.

**Everything is dark and static, with a note at the top of the page.**
That is the no-WebGL fallback doing its job. Usually a browser with hardware
acceleration disabled, or a very locked-down corporate profile.

**An exercise will not open / the page scrolls behind it.**
The overlay pins the scroll position rather than using `overflow:hidden`, because
this project's timeline is measured from real layout and freezing the body would
silently re-measure every chapter. If a browser extension is forcing smooth
scroll, the pin may fight it — the position is restored exactly on close either
way.

**Progress is not remembered between visits.**
The operator record lives in `localStorage`, which is unavailable in private
browsing and in some embedded webviews. It fails silently and the site simply
forgets you, which is the right failure mode for something this unimportant.

**It runs, but slowly, on a specific machine.**
Add `?debug` to the URL (or press `D`) for the diagnostics overlay: it reports
FPS, the tier the device was assigned, the live pixel ratio, which scenes are in
memory, draw calls and triangle count.
