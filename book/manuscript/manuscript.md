---
title: "A FAIR, pathway-level atlas of the plant spaceflight transcriptome: projecting NASA OSDR RNA-seq onto KEGG maps"
target_journal: "Gravitational and Space Research (ASGSR)"
article_type: "Methods / Technology Demonstration"
status: "DRAFT — figures/tables expand as the study loop completes"
---

# A FAIR, pathway-level atlas of the plant spaceflight transcriptome: projecting NASA OSDR RNA-seq onto KEGG maps

**Richard Barker¹**, *et al.* *(co-authors TBD)*

¹ *Affiliation TBD*

Corresponding author: Richard Barker.

---

## Abstract

Spaceflight reshapes plant gene expression, but the many independent RNA-seq
experiments archived in NASA's Open Science Data Repository (OSDR/GeneLab) are
rarely synthesised at the level of biological pathways, and the analyses are
seldom reproducible end-to-end. We present an open, FAIR pipeline and interactive
tool that discover every plant RNA-seq study in OSDR, extract each study's
differential expression for a primary spaceflight contrast, and project it onto
KEGG pathway maps, yielding a cross-study, pathway-level atlas. Applied to a
set of 14 *Arabidopsis thaliana* studies, the atlas reveals a conserved
pathway response: **plant hormone signal transduction** is the most perturbed
pathway in 12 of 14 studies and significantly perturbed in all 14 (mean 60 significant
genes; 84 % pathway coverage), accompanied by consistent changes in phenylpropanoid
biosynthesis, plant–pathogen interaction, starch/sucrose metabolism, glutathione
(oxidative-stress) metabolism and the plant circadian clock (each perturbed in
11–12 of 14 studies). All maps are
explorable in a standalone, no-install web application that colours any KEGG or
SBGN pathway by a study's data. The pipeline, atlas, and viewer are released as a
single reproducible, openly licensed repository.

**Keywords:** spaceflight; microgravity; *Arabidopsis*; RNA-seq; KEGG; pathway
analysis; OSDR; GeneLab; FAIR; reproducibility.

## 1. Introduction

Plants are essential to long-duration spaceflight as sources of food, oxygen and
psychological benefit, and they are sensitive reporters of the spaceflight
environment. Two decades of omics experiments — many conducted on the International
Space Station — have shown that spaceflight alters plant transcriptomes broadly,
implicating cell-wall remodelling, reactive-oxygen and defence signalling,
hormone pathways and the circadian clock. NASA's Open Science Data Repository
(OSDR), incorporating the GeneLab data system, now archives these datasets with
standardised, processed differential-expression tables.

Despite this, cross-study synthesis remains difficult. Individual studies differ in
genotype, tissue, age and hardware; results are usually reported as gene lists; and
re-analysis is rarely reproducible without bespoke code. Pathway-level
representation — mapping differential expression onto curated networks such as KEGG
or Systems Biology Graphical Notation (SBGN) maps — offers an interpretable,
comparable summary, but tools to do this across many OSDR studies, reproducibly and
without specialist installation, are lacking.

Here we describe (i) a small, dependency-light pipeline that turns any OSDR plant
RNA-seq study into a pathway-level projection, (ii) a cross-study atlas built from
it, and (iii) a standalone browser application that renders these projections
interactively. The system is FAIR by construction: findable and openly licensed,
built on community-standard identifiers and formats, and fully reproducible.

## 2. Methods

**Study discovery.** `osdr_discover.py` queries the OSDR search API across
space-biology plant models and retains studies whose assay is RNA sequencing,
producing a machine-readable study list.

**Differential-expression slicing.** For each study, `osdr_pipeline.py` reads the
GeneLab processed differential-expression table, selects a primary contrast
(a *Ground Control* vs *Space Flight* comparison where available) and extracts a
slim `gene_id, log2FoldChange, padj` table using the best available identifier
column (the *TAIR* locus for *Arabidopsis*; Entrez otherwise, to match KEGG).

**Pathway projection.** `osdr_project.py` retrieves each pathway's KGML from KEGG,
maps study genes onto pathway gene nodes by organism-prefix-stripped identifiers,
and computes per-pathway statistics: coverage, numbers of up- and down-regulated
genes (|log2FC| > 1), the number of significant genes (|log2FC| > 1 and adjusted
*p* < 0.05), and the mean absolute log2 fold-change. A curated pathway set targets
processes repeatedly implicated in spaceflight plant biology (Section 3).

**Interactive visualisation.** The companion web application renders SBGN-ML
(Reactome) and KGML (KEGG) maps deterministically in the browser and colours nodes
by an imported study's values; it requires no API key, login or server. Studies in
the atlas are one click away from an interactive map.

**Availability and reproducibility.** The entire atlas regenerates with
`osdr_discover.py → osdr_pipeline.py → build_book.py → jupyter-book build`. All code
is standard-library Python (plus Jupyter Book/Matplotlib for rendering).

## 3. Results

### 3.1 A reproducible plant spaceflight pathway atlas
The pipeline discovered 35 plant RNA-seq studies in OSDR (predominantly
*Arabidopsis thaliana*). Each processed study yields a slim differential-expression
table (~20,000–28,000 genes) and a projection onto 14 curated pathways, assembled
into a pathway × study matrix and an interactive book with one page per study. The
analysis below covers the first 14 processed *Arabidopsis* studies; it regenerates
automatically as the remaining studies are added.

### 3.2 A conserved, hormone-centred pathway response to spaceflight
Across the 14-study *Arabidopsis* set, pathway perturbation was strikingly
consistent (Table 1; Figure 1). **Plant hormone signal transduction** was the
most-perturbed pathway in 12 of 14 studies and showed ≥ 3 significant genes in all
14 (mean 60 significant genes; 84 % coverage). Consistently perturbed in 12 of 14
studies were **phenylpropanoid biosynthesis** (cell-wall/secondary metabolism),
**starch and sucrose metabolism**, and **plant–pathogen interaction** (defence);
oxidative-stress-associated **glutathione metabolism** and the **plant circadian
clock** (96 % coverage) were perturbed in 11 of 14. Core **carbon metabolism**
(glycolysis, Calvin-cycle carbon fixation) was perturbed in 9–10 studies. This
pattern recapitulates, at the pathway level and across independent experiments, the
hormone-, cell-wall-, defence- and clock-centred responses previously reported for
individual spaceflight studies.

**Table 1. Pathway perturbation across 14 *Arabidopsis* studies.**

| Pathway | Studies with ≥3 sig. genes | Studies where top | Mean sig. genes | Mean coverage % |
| --- | ---: | ---: | ---: | ---: |
| Plant hormone signal transduction | 14 | 12 | 59.6 | 83.5 |
| Phenylpropanoid biosynthesis | 12 | 1 | 27.3 | 78.4 |
| Starch and sucrose metabolism | 12 | 1 | 26.7 | 63.7 |
| Plant–pathogen interaction | 12 | 0 | 26.6 | 72.4 |
| Glutathione metabolism | 11 | 0 | 13.0 | 78.6 |
| Circadian rhythm – plant | 11 | 0 | 6.7 | 96.0 |
| Glycolysis / Gluconeogenesis | 10 | 0 | 12.5 | 70.1 |
| Carbon fixation (Calvin cycle) | 9 | 0 | 9.2 | 94.4 |
| Photosynthesis | 8 | 0 | 10.4 | 51.5 |
| α-Linolenic acid (jasmonate) metabolism | 8 | 0 | 6.9 | 83.8 |
| Zeatin biosynthesis | 8 | 0 | 4.5 | 72.0 |

*(Values regenerate as the remaining studies are added.)*

**Figure 1.** Pathway-activity heatmap (mean |log2FC|) across studies. See
`book/results.html`.

## 4. Discussion

Projecting many OSDR studies onto shared pathway maps converts heterogeneous gene
lists into a comparable, interpretable summary and surfaces a reproducible core of
spaceflight-responsive plant pathways dominated by hormone signalling. Because the
maps are interactive and the pipeline is openly reproducible, the atlas is both a
hypothesis-generating resource and a teaching tool.

Limitations include reliance on a single, automatically selected primary contrast
per study — preferentially a clean *Space Flight* vs *Ground Control* comparison,
but falling back to the closest available comparison where a study's design lacks
one, which should be curated before publication — variable KEGG annotation across
organisms (Arabidopsis is best-annotated), and the pathway-summary nature of the
metric, which complements rather than replaces gene-level analysis. Ongoing work extends the atlas to all 35 studies and to
additional plant species, and links pathway projections to mechanistic models such
as the Virtual Root auxin-transport simulator.

## 5. Data and code availability

- Source data: NASA OSDR/GeneLab (accessions listed per study page). https://osdr.nasa.gov
- Pathways: KEGG. https://www.kegg.jp
- Code, atlas and interactive viewer (MIT-licensed): https://github.com/dr-richard-barker/SBGN-Pathway-viewer
- Interactive app: https://dr-richard-barker.github.io/SBGN-Pathway-viewer/app/
- Atlas: https://dr-richard-barker.github.io/SBGN-Pathway-viewer/book/
- A Zenodo DOI will be minted on release.

## References

*(To format per GSR style once confirmed.)*

1. Ray S., *et al.* GeneLab / OSDR: NASA's Open Science Data Repository. *Nucleic Acids Res.*
2. Kanehisa M., Goto S. KEGG: Kyoto Encyclopedia of Genes and Genomes. *Nucleic Acids Res.* 2000.
3. Le Novère N., *et al.* The Systems Biology Graphical Notation. *Nat. Biotechnol.* 2009.
4. Paul A.-L., Ferl R.J., *et al.* Spaceflight transcriptomes of *Arabidopsis* (CARA; OSD-120).
5. Barker R., *et al.* Meta-analysis of the plant spaceflight response. *(add key refs.)*
