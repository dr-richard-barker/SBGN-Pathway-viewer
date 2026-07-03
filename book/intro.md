# OSDR Plant Pathway Atlas

A FAIR, reproducible atlas that projects **every plant RNA-seq study in NASA's
[Open Science Data Repository](https://osdr.nasa.gov) (OSDR/GeneLab)** onto **KEGG
pathway maps**, quantifying how spaceflight and altered gravity reshape plant
metabolism and signalling.

Each study's processed differential-expression table is sliced to a primary
spaceflight contrast, mapped to KEGG gene identifiers, and projected onto a curated
set of pathways. Results are summarised here and are explorable interactively — every
pathway can be opened, coloured by the study's data, in the companion
[**SBGN Pathway Visualizer**](https://dr-richard-barker.github.io/SBGN-Pathway-viewer/app/).

```{admonition} Reproduce it
:class: tip
This book is generated from a small, stdlib-only pipeline:

    python tools/osdr_discover.py       # enumerate plant RNA-seq studies
    python tools/osdr_pipeline.py       # slim + project each study
    python tools/build_book.py          # generate these pages
    jupyter-book build book
```

## Contents

- **Methods** — how studies are discovered, sliced, and projected.
- **Results** — the cross-study pathway matrix and heatmap.
- **Studies** — one page per OSDR study with its pathway projection.
