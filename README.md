# vikashksingh.com · Insights Platform

Zero-dependency static publishing engine. Markdown in, publication out.
The existing landing page is never touched: everything in `site/` is copied
into `dist/` verbatim before the Insights section is generated around it.

## Layout
```
content/insights/*.md   ← essays (front matter + Markdown)
site/                   ← your existing site, byte-for-byte (index.html + assets)
build.js                ← the engine (no npm install, ever)
netlify.toml            ← auto-deploy config (build: node build.js → dist/)
dist/                   ← output (generated; never edit by hand)
```

## Writing an essay
Create `content/insights/my-essay.md`:
```
---
title: My Essay Title
date: 2026-08-11
excerpt: One sentence that will appear on cards, in search results and social previews.
tags: innovation, essays
draft: false
---

Body in Markdown. ## for sections, > for pull quotes, ``` for code, --- for a section break.
```
Set `draft: true` to keep it out of the build until ready (`BUILD_DRAFTS=1 node build.js` previews drafts).

## Build
```
node build.js
```
Outputs: /insights/ (searchable index), /insights/<slug>/ (article pages),
/rss.xml, /sitemap.xml, robots.txt — plus your landing page at /.

## Deploy
**Automatic (recommended):** push this repo to GitHub → Netlify "Import from Git"
→ build command `node build.js`, publish directory `dist`. Every push publishes.

**Manual:** run `node build.js` locally, drag the `dist/` folder onto Netlify.

## Linking from the landing page
Add one menu item to the landing page (in Claude Design, then re-export):
`<a href="/insights/">Insights</a>` — the Insights header already links back to `/`.
