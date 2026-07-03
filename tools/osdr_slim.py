#!/usr/bin/env python3
"""
Slim a NASA OSDR (GeneLab) differential-expression table down to a small
`gene_id,log2FoldChange,padj` CSV for one contrast, drop it in public/osdr/, and
register it in public/osdr/manifest.json so the web app can project it onto
pathway maps.

This is the building block for the "loop every OSDR plant study" collection.

Usage:
  python tools/osdr_slim.py OSD-120 --list
  python tools/osdr_slim.py OSD-120 \
      --contrast "(Col-0 & Ground Control & Light Treatment)v(Col-0 & Space Flight & Light Treatment)" \
      --id TAIR --kegg ath --pathway ath00940 \
      --title "CARA — Arabidopsis root, spaceflight vs ground (Col-0, light)" \
      --organism "Arabidopsis thaliana"

Only the Python standard library is used.
"""
import argparse, csv, io, json, os, re, sys, urllib.request

OSDR = "https://osdr.nasa.gov"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "osdr")
MANIFEST = os.path.join(OUT_DIR, "manifest.json")


def osd_number(s):
    m = re.search(r"(\d+)", s)
    if not m:
        sys.exit("Provide an OSD accession like OSD-120")
    return m.group(1)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "osdr-slim/1.0"})
    return urllib.request.urlopen(req, timeout=120)


def study_files(num):
    with get(f"{OSDR}/osdr/data/osd/files/{num}/") as r:
        d = json.load(r)
    key = next(iter(d["studies"]))
    return key, d["studies"][key]["study_files"]


def find_de(files):
    for f in files:
        n = f["file_name"]
        if re.search(r"differential_expression", n, re.I) and n.lower().endswith(".csv") \
                and not re.search(r"contrasts|sampletable", n, re.I):
            return f
    return None


def download_url(f):
    u = f["remote_url"]
    return u if u.startswith("http") else OSDR + u


def stream_lines(url):
    with get(url) as r:
        for raw in io.TextIOWrapper(r, encoding="utf-8", newline=""):
            yield raw.rstrip("\n").rstrip("\r")


def list_contrasts(header):
    return [h[len("Log2fc_"):] for h in header if h.startswith("Log2fc_")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("osd")
    ap.add_argument("--list", action="store_true", help="list available contrasts and exit")
    ap.add_argument("--contrast")
    ap.add_argument("--id", default="TAIR")
    ap.add_argument("--kegg", default="")
    ap.add_argument("--pathway", default="")
    ap.add_argument("--pathway-name", default="")
    ap.add_argument("--title", default="")
    ap.add_argument("--organism", default="")
    a = ap.parse_args()

    num = osd_number(a.osd)
    key, files = study_files(num)
    de = find_de(files)
    if not de:
        sys.exit(f"{key}: no processed differential-expression CSV found.")
    url = download_url(de)

    lines = stream_lines(url)
    header = next(csv.reader([next(lines)]))
    if a.list:
        for c in list_contrasts(header):
            print(c)
        return
    if not a.contrast:
        sys.exit("Pass --contrast (use --list to see options).")

    idx = {h: i for i, h in enumerate(header)}
    id_i = idx.get(a.id)
    lfc_i = idx.get(f"Log2fc_{a.contrast}")
    padj_i = idx.get(f"Adj.p.value_{a.contrast}")
    if id_i is None or lfc_i is None:
        sys.exit("Could not find the id or contrast columns — check --id and --contrast.")

    slug = re.sub(r"[^A-Za-z0-9]+", "_", a.contrast).strip("_")[:60]
    out_name = f"{key}_{slug}.csv"
    os.makedirs(OUT_DIR, exist_ok=True)
    n = written = 0
    with open(os.path.join(OUT_DIR, out_name), "w", newline="", encoding="utf-8") as o:
        w = csv.writer(o)
        w.writerow(["gene_id", "log2FoldChange", "padj"])
        for row in csv.reader(lines):
            if not row:
                continue
            n += 1
            gid = (row[id_i] if id_i < len(row) else "").strip()
            lfc = (row[lfc_i] if lfc_i < len(row) else "").strip()
            if not gid or gid.upper() == "NA" or not lfc or lfc.upper() == "NA":
                continue
            padj = (row[padj_i] if (padj_i is not None and padj_i < len(row)) else "").strip()
            w.writerow([gid, lfc, padj])
            written += 1
    print(f"{key}: read {n} rows, wrote {written} -> public/osdr/{out_name}")

    # Register in the manifest (replace an existing entry with the same file).
    manifest = {"description": "Curated NASA OSDR differential-expression slices.", "datasets": []}
    if os.path.exists(MANIFEST):
        manifest = json.load(open(MANIFEST, encoding="utf-8"))
    entry = {
        "osd": key, "title": a.title or f"{key} {a.contrast}", "organism": a.organism,
        "keggOrg": a.kegg, "geneIdType": a.id, "contrast": a.contrast, "file": out_name,
        "genes": written, "suggestedPathwayId": a.pathway,
        "suggestedPathwayName": a.pathway_name, "source": f"{OSDR}/bio/repo/data/studies/{key}",
    }
    manifest["datasets"] = [d for d in manifest["datasets"] if d.get("file") != out_name] + [entry]
    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), indent=2)
    print(f"Registered in manifest ({len(manifest['datasets'])} datasets).")


if __name__ == "__main__":
    main()
