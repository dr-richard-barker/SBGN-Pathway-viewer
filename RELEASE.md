# Release & Zenodo checklist (v1.1.0)

Metadata is in [`.zenodo.json`](.zenodo.json) and [`CITATION.cff`](CITATION.cff).

## Before releasing — fill in (2 min)
- [ ] **ORCID** — uncomment the line in `CITATION.cff` and add `"orcid": "0000-0002-..."`
      to the creator in `.zenodo.json`.
- [ ] **Affiliation** — add `"affiliation": "..."` to the creator in `.zenodo.json`.
- [ ] Confirm `version` (1.1.0) and `date-released` are correct in both files.

## Mint the DOI
1. Sign in at <https://zenodo.org> with GitHub → **Account → GitHub**, flip the switch
   **on** for `dr-richard-barker/SBGN-Pathway-viewer`.
2. On GitHub: **Releases → Draft a new release**, tag `v1.1.0`, title it, publish.
   Zenodo catches the release webhook and mints a DOI automatically.
3. Copy the **concept DOI** (the "all versions" one) into:
   - the DOI badge in `README.md`,
   - `CITATION.cff` (`doi:` / `identifiers:`),
   - optionally `.zenodo.json`.

## What's archived
- The standalone web app (`services/`, `components/`, …) and Jekyll site (`site/`).
- The reproducible atlas pipeline (`tools/`) and Jupyter Book (`book/`).
- Curated OSDR slices (`public/osdr/`), UniProt compartments (`book/data/`), and the
  knowledge-graph export (`graph_db/`).

## Regenerate everything
```bash
python tools/osdr_discover.py
python tools/osdr_pipeline.py            # slims + projections (long; downloads DE tables)
python tools/fetch_compartments.py book/data/_allloci.txt   # UniProt compartments
python tools/compartment_summary.py      # responsiveness figure
python tools/subcellular_graph.py        # Sankey, network, graph-db
Rscript tools/build_panels_gg.R          # ggkegg panel figures (needs R + ggkegg)
python tools/build_book.py               # assemble the book
jupyter-book build book                  # render
```
