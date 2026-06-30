# Deployment & troubleshooting

How this site is built and published, and the gotchas that bit us — so future-you
doesn't re-debug them.

## Architecture

GitHub Pages allows **one** source, so a single GitHub Actions workflow builds two
things and publishes them together:

```
https://dr-richard-barker.github.io/SBGN-Pathway-viewer/        ← Jekyll website (site/)
https://dr-richard-barker.github.io/SBGN-Pathway-viewer/app/    ← the Vite app (built from repo root)
```

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

1. Build the app with Node/Vite → `dist/`.
2. Build the Jekyll site (`site/`, Cayman theme) → `_site/`.
3. Copy `dist/*` into `_site/app/`.
4. Upload `_site` as the Pages artifact and deploy.

## One-time setup (REQUIRED)

In the repo: **Settings → Pages → Build and deployment → Source = `GitHub Actions`**.

> ⚠️ **This is the #1 gotcha.** If Source is left as **"Deploy from a branch"** (the
> legacy default), GitHub runs *its own* Jekyll on the **repo root** and serves the
> app's raw `index.html`, which points at uncompiled `/index.tsx`. The browser can't
> execute TypeScript, React never mounts, and you get a **black screen**. The custom
> workflow and the `site/` folder are ignored entirely in that mode.
>
> You can also flip it via the API:
> `gh api --method PUT repos/<owner>/<repo>/pages -f build_type=workflow`

After that, every push to `main` rebuilds and redeploys automatically. Hard-refresh
(Ctrl+F5) after a deploy to clear the cached page.

## Gotchas we hit

- **Black screen** → Pages was in "Deploy from a branch" mode (see above). Fix: Source = GitHub Actions.
- **Jekyll build fails: `No repo name found`** → the `github-pages` metadata plugin
  (used by the Cayman theme via `site.github`) needs the repo when building outside the
  legacy Pages environment. Fixed by `repository: <owner>/<repo>` in
  [`site/_config.yml`](site/_config.yml) and `PAGES_REPO_NWO` in the workflow.
- **`baseurl`** must be `/SBGN-Pathway-viewer` for a project site. Change it (and the
  Cayman links) if you rename the repo or attach a custom domain.

## Data-source connectivity (runtime)

The app fetches pathways at runtime, in the browser:

- **Reactome** (SBGN) — CORS-enabled; fetched directly, proxy as fallback.
- **KEGG** (KGML + pathway image) — KEGG has **no CORS headers**, so requests go through a
  **chain of public CORS proxies** ([`services/proxy.ts`](services/proxy.ts)): it tries
  each in turn (corsproxy.io → allorigins → codetabs → thingproxy) until one works.
  Individual free proxies are flaky; the chain is what keeps KEGG usable. If KEGG ever
  fails for everyone, the fix is to add/replace a proxy in that list (or stand up your own).
- KEGG gene matching: AGI locus ids (`ath:AT1G12345` → `AT1G12345`), Entrez (`hsa:7157` → `7157`),
  and gene symbols all match. Verified with Arabidopsis (`ath`) — see
  [`examples/arabidopsis_kegg_demo.csv`](examples/arabidopsis_kegg_demo.csv).

## Local preview

```bash
npm install && npm run dev          # the app (http://localhost:5173)
cd site && bundle install && bundle exec jekyll serve   # the website
```
