#!/usr/bin/env python3
"""
Batch pipeline: loop the discovered OSDR plant RNA-seq studies, slim each to a
primary spaceflight contrast, project onto the KEGG pathway set, and accumulate a
long-form results matrix. Also registers each slim table in public/osdr/manifest.json
so it appears in the web app's curated collection.

Run order:
    python tools/osdr_discover.py            # -> book/data/plant_rnaseq_studies.csv
    python tools/osdr_pipeline.py            # loop all (add --limit N / --only OSD-120)
    python tools/build_book.py               # -> Jupyter Book pages
    jupyter-book build book

Stdlib only for the pipeline itself.
"""
import argparse, csv, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from osdr_slim import study_files, find_de, download_url, stream_lines  # noqa: E402
from osdr_project import project, DEFAULT_PATHWAYS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUDIES = os.path.join(ROOT, "book", "data", "plant_rnaseq_studies.csv")
MATRIX = os.path.join(ROOT, "book", "data", "pathway_projection_matrix.csv")
SLIM_DIR = os.path.join(ROOT, "public", "osdr")
MANIFEST = os.path.join(SLIM_DIR, "manifest.json")

# For non-Arabidopsis organisms KEGG genes are keyed by Entrez, not locus.
ID_PREFERENCE = {"ath": ["TAIR", "ENTREZID", "ENSEMBL"]}
DEFAULT_ID_ORDER = ["ENTREZID", "TAIR", "ENSEMBL", "SYMBOL"]


def pick_primary_contrast(contrasts):
    """A ground-control vs space-flight contrast if present, else the first."""
    for c in contrasts:
        cl = c.lower()
        if "ground control" in cl and "space flight" in cl:
            return c
    return contrasts[0] if contrasts else None


def load_contrast_names(files):
    cf = next((f for f in files if re.search(r"contrasts.*\.csv$", f["file_name"], re.I)), None)
    if not cf:
        return []
    first = next(stream_lines(download_url(cf)))
    return [c.strip().strip('"') for c in first.split(",") if ")v(" in c]


def slim_contrast(de_url, contrast, id_cols):
    """Stream the DE table, choose the first id column that yields data, return (id_col, rows)."""
    lines = stream_lines(de_url)
    header = next(csv.reader([next(lines)]))
    idx = {h: i for i, h in enumerate(header)}
    lfc_i = idx.get(f"Log2fc_{contrast}")
    padj_i = idx.get(f"Adj.p.value_{contrast}")
    id_col = next((c for c in id_cols if c in idx), None)
    if lfc_i is None or id_col is None:
        return None, []
    id_i = idx[id_col]
    rows = []
    for row in csv.reader(lines):
        if not row or id_i >= len(row) or lfc_i >= len(row):
            continue
        gid, lfc = row[id_i].strip(), row[lfc_i].strip()
        if not gid or gid.upper() == "NA" or not lfc or lfc.upper() == "NA":
            continue
        padj = row[padj_i].strip() if (padj_i is not None and padj_i < len(row)) else ""
        rows.append((gid, lfc, padj))
    return id_col, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="process at most N studies")
    ap.add_argument("--only", default="", help="comma-separated accessions to process")
    ap.add_argument("--max-mb", type=int, default=0, help="skip DE tables larger than this (0 = no limit)")
    a = ap.parse_args()

    only = {s.strip() for s in a.only.split(",") if s.strip()}
    studies = list(csv.DictReader(open(STUDIES, encoding="utf-8")))
    if only:
        studies = [s for s in studies if s["accession"] in only]
    if a.limit:
        studies = studies[: a.limit]

    manifest = {"description": "Curated NASA OSDR differential-expression slices.", "datasets": []}
    if os.path.exists(MANIFEST):
        manifest = json.load(open(MANIFEST, encoding="utf-8"))
    by_file = {d["file"]: d for d in manifest["datasets"]}

    matrix_rows, summary = [], []
    for s in studies:
        acc, org, kegg = s["accession"], s["organism"], s["kegg_org"]
        if not kegg:
            summary.append((acc, "skip: no KEGG org")); continue
        try:
            key, files = study_files(re.search(r"\d+", acc).group())
            de = find_de(files)
            if not de:
                summary.append((acc, "skip: no DE table")); continue
            size_mb = (de.get("file_size") or 0) / 1e6
            if a.max_mb and size_mb > a.max_mb:
                summary.append((acc, f"skip: DE {size_mb:.0f}MB > {a.max_mb}")); continue
            contrasts = load_contrast_names(files)
            contrast = pick_primary_contrast(contrasts)
            if not contrast:
                summary.append((acc, "skip: no contrasts")); continue

            id_cols = ID_PREFERENCE.get(kegg, DEFAULT_ID_ORDER)
            id_col, rows = slim_contrast(download_url(de), contrast, id_cols)
            if not rows:
                summary.append((acc, "skip: contrast columns not found")); continue

            slug = re.sub(r"[^A-Za-z0-9]+", "_", contrast).strip("_")[:50]
            fname = f"{key}_{slug}.csv"
            with open(os.path.join(SLIM_DIR, fname), "w", newline="", encoding="utf-8") as o:
                w = csv.writer(o); w.writerow(["gene_id", "log2FoldChange", "padj"]); w.writerows(rows)

            stats = list(project(os.path.join(SLIM_DIR, fname), kegg))
            for st in stats:
                matrix_rows.append({"accession": key, "organism": org, "contrast": contrast, **st})

            top = max(stats, key=lambda x: x["n_sig"], default=None)
            by_file[fname] = {
                "osd": key, "title": s["title"][:120], "organism": org, "keggOrg": kegg,
                "geneIdType": id_col, "contrast": contrast, "file": fname, "genes": len(rows),
                "suggestedPathwayId": top["kegg_pathway"] if top else "",
                "suggestedPathwayName": top["pathway_name"] if top else "",
                "source": f"https://osdr.nasa.gov/bio/repo/data/studies/{key}",
            }
            summary.append((acc, f"ok: {len(rows)} genes, id={id_col}, {len(stats)} pathways"))
            print(f"{acc}: {len(rows)} genes ({id_col}); top pathway {top['pathway_name'] if top else '-'}")
        except Exception as e:  # noqa
            summary.append((acc, f"error: {e}"))
            print(f"{acc}: ERROR {e}", file=sys.stderr)

    # Write outputs.
    if matrix_rows:
        os.makedirs(os.path.dirname(MATRIX), exist_ok=True)
        with open(MATRIX, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(matrix_rows[0].keys()))
            w.writeheader(); w.writerows(matrix_rows)
    manifest["datasets"] = sorted(by_file.values(), key=lambda d: d["osd"])
    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), indent=2)

    print("\n=== summary ===")
    for acc, msg in summary:
        print(f"  {acc:10s} {msg}")
    print(f"\n{len([1 for _,m in summary if m.startswith('ok')])} ok / {len(summary)} studies; "
          f"{len(matrix_rows)} matrix rows -> {os.path.relpath(MATRIX, ROOT)}")


if __name__ == "__main__":
    main()
