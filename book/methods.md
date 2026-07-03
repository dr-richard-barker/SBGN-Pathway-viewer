# Methods

## Study discovery
`tools/osdr_discover.py` queries the OSDR search API
(`/osdr/data/search?type=cgene&ffield=organism&fvalue=<organism>`) across space-biology
plant models and keeps studies whose assay type is RNA sequencing, writing
`book/data/plant_rnaseq_studies.csv`.

## Slicing
For each study, `tools/osdr_pipeline.py` reads the GeneLab processed
*differential expression* table (`GLDS-*_rna_seq_differential_expression_*.csv`),
selects a **primary contrast** (a *Ground Control* vs *Space Flight* comparison where
available), and extracts a slim `gene_id, log2FoldChange, padj` table using the best
available identifier column (`TAIR` locus for Arabidopsis; `ENTREZID` otherwise, to
match KEGG). Slim tables are written to `public/osdr/` and registered in the app's
catalog (`manifest.json`).

## Projection
`tools/osdr_project.py` fetches each pathway's KGML from KEGG, maps the study genes to
the pathway's gene nodes (organism-prefix-stripped identifiers, e.g. `ath:AT1G12345` →
`AT1G12345`), and computes per-pathway statistics:

| field | meaning |
| --- | --- |
| `n_pathway_genes` | gene nodes in the KEGG pathway |
| `n_mapped` / `coverage_pct` | study genes matched onto the pathway |
| `n_up` / `n_down` | mapped genes with log2FC > 1 / < −1 |
| `n_sig` | mapped genes with |log2FC| > 1 and adjusted p < 0.05 |
| `mean_abs_log2fc` | mean absolute log2 fold-change of mapped genes |

The curated pathway set (`DEFAULT_PATHWAYS`) targets processes repeatedly implicated in
spaceflight plant biology: photosynthesis and carbon fixation, starch/sucrose,
phenylpropanoid and flavonoid (cell wall / secondary metabolism), jasmonate and other
hormone signalling, glutathione (oxidative stress), and the plant circadian clock.

## Limitations
- KEGG coverage varies by organism; Arabidopsis (`ath`) is best-annotated.
- A single primary contrast per study is projected here; the pipeline can emit all
  contrasts if desired.
- Pathway-level summaries complement, not replace, gene-level differential expression.
