---
layout: default
title: How to use
description: Step-by-step guide to overlaying omics data on SBGN and KEGG pathway maps.
permalink: /usage/
---

[← Back home]({{ '/' | relative_url }}) · [🚀 Launch the app]({{ '/app/' | relative_url }})

## Step by step

1. **Upload data** — a CSV/TSV with identifiers in the **first column**. For fold-change data,
   include a `log2FoldChange` (or `lfc`) column; for counts/abundance, the numeric columns are
   averaged. You can also click *Or use sample data* to try it instantly.
2. **Choose a pathway source:**
   - **Reactome** — fetches the real, layout-complete SBGN export for the pathway.
   - **KEGG** — fetches KGML. Toggle between **Image overlay** (your data over KEGG's official
     diagram) and **Vector (KGML)** (clean, editable SVG).
   - **Custom SBGN File** — upload any `.sbgn` map (Newt, Reactome, VANTED/SBGN-ED, CySBGN…).
3. **Select species & pathway.** Pathways that contain genes from your data are grouped at the
   top of the list.
4. **Set the data type** — *Normalized counts / abundance* (sequential scale) or *Log2 fold
   change* (divergent scale).
5. **Generate.** The map renders in your browser. Or click **Try offline demo** for a bundled
   example with no network.
6. **Explore & download.** Pan, zoom, hover a coloured node for its values, search to highlight,
   and **Download SVG**.

## Identifier matching

| Source | Matched against |
| --- | --- |
| SBGN (Reactome / custom) | glyph label (whole label, then word tokens) |
| KEGG genes | node symbols (`graphics name`, e.g. `ENO1`) **and** ids with the organism prefix stripped (`ath:AT1G12345` → `AT1G12345`, `hsa:7157` → `7157`) |
| KEGG compounds | KEGG compound ids (`C00022`) |

So gene symbols, locus ids and Entrez ids all work for KEGG. Matching is case-insensitive.

## Notes

- KEGG REST has no CORS headers, so KGML and images are fetched via a free public proxy.
- Databases without SBGN-ML/KGML (MetaCyc, SMPDB, PANTHER, MetaCrop) can still be visualised by
  exporting them to SBGN (e.g. via [Newt](https://newteditor.org/)) and using **Custom SBGN File**.

[🚀 Launch the app]({{ '/app/' | relative_url }})
