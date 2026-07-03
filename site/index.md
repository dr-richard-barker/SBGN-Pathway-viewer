---
layout: default
title: Home
description: >-
  Overlay RNA-seq and other omics data onto SBGN (Reactome) and KEGG pathway
  maps, right in your browser — no API key, no AI service.
---

<style>
.portal-hero { text-align: center; margin: 0.5rem 0 1.5rem; }
.portal-cta {
  display: inline-block; background: #0891b2; color: #fff !important;
  padding: 0.95rem 2rem; border-radius: 10px; font-size: 1.2rem; font-weight: 700;
  text-decoration: none; box-shadow: 0 3px 10px rgba(0,0,0,.18);
}
.portal-cta:hover { background: #0e7490; }
.portal-sub { margin-top: 0.6rem; font-size: 0.95rem; }
.portal-cards {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem; margin: 1.5rem 0 0.5rem;
}
.portal-card {
  border: 1px solid #dfe2e5; border-radius: 12px; padding: 1.1rem 1.2rem;
  text-decoration: none !important; color: inherit; display: block;
  transition: box-shadow .15s ease, transform .15s ease; background: #fff;
}
.portal-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,.10); transform: translateY(-2px); }
.portal-card .emoji { font-size: 1.9rem; line-height: 1; }
.portal-card h3 { margin: .45rem 0 .35rem; font-size: 1.15rem; }
.portal-card p { margin: 0; font-size: 0.9rem; color: #586069; }
</style>

<div class="portal-hero">
  <a class="portal-cta" href="{{ '/app/' | relative_url }}">🚀 Launch the SBGN Pathway Viewer</a>
  <div class="portal-sub">Free · runs in your browser · no login, no API key</div>
</div>

<div class="portal-cards">
  <a class="portal-card" href="{{ '/app/' | relative_url }}">
    <span class="emoji">🧬</span>
    <h3>Interactive viewer</h3>
    <p>Overlay RNA-seq / omics data onto SBGN (Reactome) & KEGG pathway maps and export SVG.</p>
  </a>
  <a class="portal-card" href="{{ '/book/' | relative_url }}">
    <span class="emoji">🌍</span>
    <h3>OSDR Pathway Atlas</h3>
    <p>Every NASA plant spaceflight study projected onto KEGG pathways — one page per study.</p>
  </a>
  <a class="portal-card" href="{{ '/usage/' | relative_url }}">
    <span class="emoji">📖</span>
    <h3>How to use</h3>
    <p>Step-by-step guide, including importing straight from the NASA OSDR API.</p>
  </a>
  <a class="portal-card" href="https://github.com/dr-richard-barker/SBGN-Pathway-viewer">
    <span class="emoji">⭐</span>
    <h3>Source & pipeline</h3>
    <p>Open, MIT-licensed code, the reproducible pipeline, and the FAIR data.</p>
  </a>
</div>

**SBGN Pathway Visualizer** is a free, standalone web app that overlays your
RNA-seq (and other omics) data onto **SBGN** and **KEGG** pathway maps. Everything
runs in your browser — there is **no API key, no login, and no AI service**.
Maps are rendered *deterministically* from real pathway geometry, so results are
reproducible and publication-ready.

## What it does

- **Upload** a CSV/TSV of genes (and optionally compounds), identifiers in the first column.
- **Pick a source** — **Reactome** (real SBGN export), **KEGG** (KGML, as a clean vector
  *or* a pathview-style overlay on KEGG's official diagram), or **upload your own** `.sbgn` file.
- **See your data** coloured onto each node on a divergent (fold-change) or sequential
  (abundance) scale, with a legend.
- **Explore & export** — pan, zoom, hover for values, search to highlight, and download a
  publication-ready **SVG**.
- **Offline demo** — one click renders a bundled example with zero network.

## Why it's different

Earlier versions used Google AI Studio / Gemini to *draw* the map. This version removes that
dependency entirely and renders from community-standard **SBGN-ML** and **KEGG KGML** — faithful,
reproducible, and yours to reuse.

## FAIR & open

Findable (rich metadata, citation files), Accessible (free, open, runs client-side, WCAG-minded),
Interoperable (standard SBGN-ML / KGML in, standard SVG out), Reusable (MIT licensed,
self-contained output). See the [repository](https://github.com/dr-richard-barker/SBGN-Pathway-viewer)
for a Zenodo DOI once released.

## Cite

> Barker, R. *SBGN Pathway Visualizer* (v1.0.0), 2026.
> <https://github.com/dr-richard-barker/SBGN-Pathway-viewer>

---

<small>MIT licensed. Pathway data and images belong to their providers (Reactome, KEGG);
please observe their terms when reusing exported figures.</small>
