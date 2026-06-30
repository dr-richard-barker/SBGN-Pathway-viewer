---
layout: default
title: Home
description: >-
  Overlay RNA-seq and other omics data onto SBGN (Reactome) and KEGG pathway
  maps, right in your browser — no API key, no AI service.
---

<p>
  <a href="{{ '/app/' | relative_url }}" class="btn">🚀 Launch the app</a>
  <a href="{{ '/usage/' | relative_url }}" class="btn">📖 How to use</a>
  <a href="https://github.com/dr-richard-barker/SBGN-Pathway-viewer" class="btn">⭐ Source on GitHub</a>
</p>

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
