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


def load_csv(path):
    return list(csv.DictReader(open(path, encoding="utf-8"))) if os.path.exists(path) else []


def md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def main():
    matrix = load_csv(os.path.join(DATA, "pathway_projection_matrix.csv"))
    studies = {s["accession"]: s for s in load_csv(os.path.join(DATA, "plant_rnaseq_studies.csv"))}
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
        open(os.path.join(BOOK, "studies", f"{acc}.md"), "w", encoding="utf-8").write("\n".join(lines))

    # Cross-study results page (+ optional heatmap)
    pathways = list(dict.fromkeys((r["kegg_pathway"], r["pathway_name"]) for r in matrix))
    heatmap_md = ""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        accs = list(by_study.keys())
        pmap = {p[0]: i for i, p in enumerate(pathways)}
        grid = [[float("nan")] * len(accs) for _ in pathways]
        for j, acc in enumerate(accs):
            for r in by_study[acc]:
                grid[pmap[r["kegg_pathway"]]][j] = float(r["mean_abs_log2fc"])
        fig, ax = plt.subplots(figsize=(max(4, 1.2 * len(accs) + 3), 0.4 * len(pathways) + 2))
        im = ax.imshow(grid, aspect="auto", cmap="viridis")
        ax.set_xticks(range(len(accs))); ax.set_xticklabels(accs, rotation=45, ha="right", fontsize=8)
        ax.set_yticks(range(len(pathways))); ax.set_yticklabels([p[1] for p in pathways], fontsize=8)
        fig.colorbar(im, ax=ax, label="mean |log2FC|")
        fig.tight_layout()
        os.makedirs(os.path.join(BOOK, "_static"), exist_ok=True)
        fig.savefig(os.path.join(BOOK, "_static", "pathway_heatmap.png"), dpi=140)
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
