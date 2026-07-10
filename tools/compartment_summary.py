#!/usr/bin/env python3
"""Cross-study cellular-site responsiveness: for each subcellular compartment, the
fraction of that compartment's expressed genes that are significantly DE, per study,
and averaged across studies. Writes a compartment x study heatmap + a summary table
that build_book.py embeds in the results page."""
import csv, json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(ROOT, "book")
SLIM = os.path.join(ROOT, "public", "osdr")
LFC, PADJ = 1.0, 0.05
ORDER = ["Nucleus", "Cytoplasm", "Chloroplast", "Mitochondrion", "Endoplasmic reticulum",
         "Golgi", "Plasma membrane", "Vacuole", "Peroxisome", "Cell wall / apoplast", "Membrane (unspecified)"]


def main():
    comp = {}
    for row in csv.DictReader(open(os.path.join(BOOK, "data", "ath_compartments_all.tsv"), encoding="utf-8"), delimiter="\t"):
        comp[row["locus"].upper()] = row["compartment"]
    man = {d["osd"]: d for d in json.load(open(os.path.join(SLIM, "manifest.json"), encoding="utf-8"))["datasets"]}
    studies = sorted(man)

    # rate[compartment][study] = % of that compartment's tested genes that are sig
    rate = {c: {} for c in ORDER}
    overall = {}
    for acc in studies:
        tested = {c: 0 for c in ORDER}; sig = {c: 0 for c in ORDER}
        ov_t = ov_s = 0
        for r in csv.DictReader(open(os.path.join(SLIM, man[acc]["file"]), encoding="utf-8")):
            c = comp.get(r["gene_id"].upper())
            if c not in tested:
                continue
            try:
                lfc = float(r["log2FoldChange"]); pj = float(r["padj"])
            except Exception:
                continue
            tested[c] += 1; ov_t += 1
            if abs(lfc) > LFC and pj < PADJ:
                sig[c] += 1; ov_s += 1
        for c in ORDER:
            rate[c][acc] = 100.0 * sig[c] / tested[c] if tested[c] else float("nan")
        overall[acc] = 100.0 * ov_s / ov_t if ov_t else float("nan")

    # per-compartment mean %DE + mean enrichment vs the study's overall %DE
    summ = []
    for c in ORDER:
        vals = [rate[c][a] for a in studies if rate[c][a] == rate[c][a]]
        enr = [rate[c][a] / overall[a] for a in studies if overall.get(a) and rate[c][a] == rate[c][a] and overall[a] > 0]
        summ.append((c, sum(vals) / len(vals) if vals else 0,
                     sum(enr) / len(enr) if enr else 0))
    summ.sort(key=lambda x: -x[1])

    with open(os.path.join(BOOK, "data", "compartment_summary.tsv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t"); w.writerow(["compartment", "mean_pct_DE", "mean_enrichment"])
        for c, m, e in summ:
            w.writerow([c, f"{m:.1f}", f"{e:.2f}"])

    # heatmap: compartments (rows, responsiveness order) x studies (cols)
    rows = [c for c, _, _ in summ]
    grid = [[rate[c][a] for a in studies] for c in rows]
    fig, ax = plt.subplots(figsize=(0.34 * len(studies) + 3.5, 0.42 * len(rows) + 1.6))
    im = ax.imshow(grid, aspect="auto", cmap="magma")
    ax.set_xticks(range(len(studies))); ax.set_xticklabels(studies, rotation=90, fontsize=7)
    ax.set_yticks(range(len(rows))); ax.set_yticklabels(rows, fontsize=8)
    ax.set_xticks([x - 0.5 for x in range(1, len(studies))], minor=True)
    ax.set_yticks([y - 0.5 for y in range(1, len(rows))], minor=True)
    ax.grid(which="minor", color="white", linewidth=0.5); ax.tick_params(which="minor", length=0)
    fig.colorbar(im, ax=ax, label="% of compartment genes significantly DE", fraction=0.025, pad=0.02)
    ax.set_title("Cellular-site responsiveness to spaceflight (Arabidopsis, OSDR)", fontsize=10)
    fig.tight_layout()
    fig.savefig(os.path.join(BOOK, "_static", "compartment_responsiveness.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("compartments ranked by mean %DE across studies:")
    for c, m, e in summ:
        print(f"  {c:24s} {m:5.1f}%  enrich x{e:.2f}")


if __name__ == "__main__":
    main()
