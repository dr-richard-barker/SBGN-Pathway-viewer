#!/usr/bin/env python3
"""
Generate Jupyter Book pages from the pipeline outputs: one page per study, a
cross-study results page (+ heatmap if matplotlib is available), and the _toc.yml.
Stdlib only; matplotlib is optional (used only for the heatmap image).
"""
import csv, json, os
from collections import defaultdict, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(ROOT, "book")
DATA = os.path.join(BOOK, "data")
APP = "https://dr-richard-barker.github.io/SBGN-Pathway-viewer/app/"


def load_csv(path, delim=","):
    return list(csv.DictReader(open(path, encoding="utf-8"), delimiter=delim)) if os.path.exists(path) else []


def md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def main():
    matrix = load_csv(os.path.join(DATA, "pathway_projection_matrix.csv"))
    studies = {s["accession"]: s for s in load_csv(os.path.join(DATA, "plant_rnaseq_studies.csv"))}
    panels_index = json.load(open(os.path.join(DATA, "panels_index.json"), encoding="utf-8")) \
        if os.path.exists(os.path.join(DATA, "panels_index.json")) else {}
    manifest = json.load(open(os.path.join(ROOT, "public", "osdr", "manifest.json"), encoding="utf-8")) \
        if os.path.exists(os.path.join(ROOT, "public", "osdr", "manifest.json")) else {"datasets": []}
    man_by_osd = {d["osd"]: d for d in manifest.get("datasets", [])}

    by_study = OrderedDict()
    for r in matrix:
        by_study.setdefault(r["accession"], []).append(r)

    os.makedirs(os.path.join(BOOK, "studies"), exist_ok=True)

    # Per-study pages
    for acc, rows in by_study.items():
        meta = studies.get(acc, {})
        man = man_by_osd.get(acc, {})
        contrast = rows[0]["contrast"]
        lines = [f"# {acc}", ""]
        if meta.get("title"):
            lines += [f"**{meta['title']}**", ""]
        lines += [
            f"- Organism: *{meta.get('organism', rows[0].get('organism', ''))}*",
            f"- Contrast: `{contrast}`",
            f"- [Study on OSDR](https://osdr.nasa.gov/bio/repo/data/studies/{acc})",
            f"- [Open in the interactive viewer]({APP}) — Import from OSDR → Curated → {acc}",
            "",
            "## Pathway projection",
            "",
            md_table(
                ["KEGG", "Pathway", "genes", "mapped", "cov %", "up", "down", "sig", "mean|log2FC|"],
                [[r["kegg_pathway"], r["pathway_name"], r["n_pathway_genes"], r["n_mapped"],
                  r["coverage_pct"], r["n_up"], r["n_down"], r["n_sig"], r["mean_abs_log2fc"]] for r in rows],
            ),
            "",
        ]
        # Static "panel figures" — data projected onto the KEGG map + significant-loci
        # heatmap — for each significantly perturbed pathway (no interactive viewer needed).
        panels = panels_index.get(acc, [])
        if panels:
            lines += [
                "## Static pathway projections",
                "",
                "Each panel: the study's data projected onto the KEGG pathway (left; red = up, "
                "blue = down) beside a heatmap of that pathway's significant loci (right, log2FC).",
                "",
            ]
            for p in panels:
                lines += [
                    f"### {p['pid']} — {p['name']}  ·  {p['n_sig']} significant genes",
                    "",
                    f"![{acc} {p['name']}](../_static/panels/{p['png']})",
                    "",
                ]
        open(os.path.join(BOOK, "studies", f"{acc}.md"), "w", encoding="utf-8").write("\n".join(lines))

    # Cross-study results page (+ optional heatmap).
    # Orientation: studies as ROWS (readable horizontal labels), pathways as COLUMNS
    # (vertical 90° labels) — much easier to read than the previous layout. Pathways
    # ordered by how many studies perturb them (most-conserved first).
    order = sorted(
        dict.fromkeys((r["kegg_pathway"], r["pathway_name"]) for r in matrix),
        key=lambda p: -sum(1 for r in matrix if r["kegg_pathway"] == p[0] and int(r["n_sig"]) >= 3),
    )
    pathways = order
    heatmap_md = ""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        accs = sorted(by_study.keys())
        pcol = {p[0]: j for j, p in enumerate(pathways)}
        grid = [[float("nan")] * len(pathways) for _ in accs]        # rows=studies, cols=pathways
        for i, acc in enumerate(accs):
            for r in by_study[acc]:
                grid[i][pcol[r["kegg_pathway"]]] = float(r["mean_abs_log2fc"])
        fig, ax = plt.subplots(figsize=(0.62 * len(pathways) + 3.5, 0.34 * len(accs) + 2.2))
        im = ax.imshow(grid, aspect="auto", cmap="magma")
        ax.set_xticks(range(len(pathways)))
        ax.set_xticklabels([p[1] for p in pathways], rotation=90, fontsize=8)
        ax.set_yticks(range(len(accs))); ax.set_yticklabels(accs, fontsize=8)
        ax.set_xticks([x - 0.5 for x in range(1, len(pathways))], minor=True)
        ax.set_yticks([y - 0.5 for y in range(1, len(accs))], minor=True)
        ax.grid(which="minor", color="white", linewidth=0.5)
        ax.tick_params(which="minor", length=0)
        fig.colorbar(im, ax=ax, label="mean |log2FC|", fraction=0.025, pad=0.02)
        ax.set_title("Pathway perturbation across OSDR plant spaceflight studies", fontsize=10)
        fig.tight_layout()
        os.makedirs(os.path.join(BOOK, "_static"), exist_ok=True)
        fig.savefig(os.path.join(BOOK, "_static", "pathway_heatmap.png"), dpi=150, bbox_inches="tight")
        plt.close(fig)
        heatmap_md = "![Pathway × study heatmap](_static/pathway_heatmap.png)\n"
    except Exception as e:  # noqa
        heatmap_md = f"*(Install matplotlib to render the heatmap: {e})*\n"

    res = ["# Results", "",
           f"Projection across **{len(by_study)} studies** and **{len(pathways)} pathways**.",
           "", "## Pathway activity heatmap", "", heatmap_md, "",
           "## Most-perturbed pathway per study", "",
           md_table(["Study", "Top pathway (most significant genes)", "sig genes"],
                    [[acc, max(rows, key=lambda r: int(r["n_sig"]))["pathway_name"],
                      max(int(r["n_sig"]) for r in rows)] for acc, rows in by_study.items()]),
           ""]

    # Cellular-site responsiveness (from tools/compartment_summary.py)
    csum = os.path.join(DATA, "compartment_summary.tsv")
    if os.path.exists(csum):
        rows_c = load_csv(csum, delim="\t")
        res += [
            "## Cellular-site responsiveness", "",
            "For each subcellular compartment, the fraction of that compartment's expressed "
            "genes that are significantly differentially expressed (|log2FC| > 1, adj. *p* < 0.05), "
            "averaged across studies. Enrichment is relative to each study's genome-wide rate. "
            "Compartments (UniProt) for ~12,500 Arabidopsis genes.", "",
            "![Cellular-site responsiveness heatmap](_static/compartment_responsiveness.png)", "",
            md_table(["Compartment", "Mean % genes DE", "Enrichment vs genome"],
                     [[r["compartment"], r["mean_pct_DE"], f"×{r['mean_enrichment']}"] for r in rows_c]),
            "",
        ]
        note = ("*Compartments are from UniProt. Organelle membranes (chloroplast, mitochondrion, "
                "ER, Golgi, vacuole/tonoplast) are counted **with their organelle**; "
                "**Plasma membrane** is UniProt \"Cell membrane\"; **Membrane (unspecified)** is "
                "membrane-annotated proteins with no organelle specified.*")
        res += [note, ""]

    # Holistic subcellular view: Sankey + network + graph database
    if os.path.exists(os.path.join(BOOK, "_static", "sankey_pathway_compartment.png")):
        res += [
            "## Subcellular localisation of pathway changes", "",
            "Where do the significant genes of each pathway act? These holistic views aggregate "
            "significant-gene events across all studies.", "",
            "### Pathway → compartment (Sankey)", "",
            "![Sankey: pathway to compartment](_static/sankey_pathway_compartment.png)", "",
            "[Open the interactive Sankey](_static/sankey_pathway_compartment.html)", "",
            "### Pathway ↔ compartment network", "",
            "![Pathway–compartment network](_static/pathway_compartment_network.png)", "",
            "### Knowledge graph (graph database)", "",
            "The full Gene–Pathway–Compartment–Study graph is exported for graph databases: "
            "`graph_db/spaceflight_atlas.graphml` (Cytoscape/Gephi/yEd) and "
            "`graph_db/{nodes,edges}.csv` + `import.cypher` (Neo4j).", "",
        ]
    open(os.path.join(BOOK, "results.md"), "w", encoding="utf-8").write("\n".join(res))

    # Table of contents
    toc = ["format: jb-book", "root: intro", "chapters:",
           "  - file: methods", "  - file: results"]
    if os.path.exists(os.path.join(BOOK, "manuscript", "manuscript.md")):
        toc.append("  - file: manuscript/manuscript")
    toc.append("  - file: studies/index")
    open(os.path.join(BOOK, "studies", "index.md"), "w", encoding="utf-8").write(
        "# Studies\n\n" + "\n".join(f"- [{acc}](./{acc}.md) — {studies.get(acc, {}).get('title', '')[:80]}"
                                    for acc in by_study) + "\n")
    toc[-1] = "  - file: studies/index\n    sections:"
    for acc in by_study:
        toc.append(f"      - file: studies/{acc}")
    open(os.path.join(BOOK, "_toc.yml"), "w", encoding="utf-8").write("\n".join(toc) + "\n")

    print(f"Generated {len(by_study)} study pages + results + toc.")


if __name__ == "__main__":
    main()
