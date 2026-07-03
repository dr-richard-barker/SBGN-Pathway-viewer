#!/usr/bin/env python3
"""
Discover every plant RNA-seq study in NASA OSDR and write a study list the
pipeline can loop over.

Queries the OSDR search API per plant organism, keeps studies whose assay is
RNA sequencing, dedupes by accession, and writes book/data/plant_rnaseq_studies.csv.

Stdlib only.  Usage:  python tools/osdr_discover.py
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

OSDR = "https://osdr.nasa.gov"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "book", "data", "plant_rnaseq_studies.csv")

# Space-biology plant models (KEGG org code where known; '' = resolve later).
PLANTS = {
    "Arabidopsis thaliana": "ath",
    "Solanum lycopersicum": "sly",
    "Brachypodium distachyon": "bdi",
    "Glycine max": "gmx",
    "Oryza sativa": "osa",
    "Oryza sativa Japonica Group": "osa",
    "Zea mays": "zma",
    "Triticum aestivum": "taes",
    "Physcomitrium patens": "ppp",
    "Physcomitrella patens": "ppp",
    "Marchantia polymorpha": "mpol",
    "Lactuca sativa": "lsv",
    "Brassica rapa": "brp",
    "Populus": "pop",
    "Lemna": "",
    "Mizuna": "",
    "Pisum sativum": "",
}

RNASEQ_HINTS = ("rna sequencing", "rna-seq", "rna seq", "transcription profiling")


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "osdr-discover/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def search_organism(org):
    out, frm, size = [], 0, 100
    while True:
        q = urllib.parse.urlencode({
            "term": "", "type": "cgene", "from": frm, "size": size,
            "ffield": "organism", "fvalue": org,
        })
        d = get_json(f"{OSDR}/osdr/data/search?{q}")
        hits = d.get("hits", {}).get("hits", [])
        if not hits:
            break
        out.extend(h.get("_source", {}) for h in hits)
        total = d.get("hits", {}).get("total")
        total = total.get("value") if isinstance(total, dict) else total
        frm += size
        if total is None or frm >= total:
            break
        time.sleep(0.2)
    return out


def main():
    seen, rows = set(), []
    for org, kegg in PLANTS.items():
        try:
            src = search_organism(org)
        except Exception as e:  # noqa
            print(f"  ! {org}: {e}", file=sys.stderr)
            continue
        kept = 0
        for s in src:
            acc = s.get("Accession") or s.get("Study Identifier")
            assay = (s.get("Study Assay Technology Type") or "")
            assay_l = assay.lower() if isinstance(assay, str) else " ".join(assay).lower()
            if not acc or acc in seen:
                continue
            if not any(h in assay_l for h in RNASEQ_HINTS):
                continue
            seen.add(acc)
            rows.append({
                "accession": acc,
                "organism": org,
                "kegg_org": kegg,
                "assay": assay if isinstance(assay, str) else "; ".join(assay),
                "title": s.get("Study Title", ""),
                "factors": s.get("Study Factor Name", ""),
                "release": s.get("Study Public Release Date", ""),
            })
            kept += 1
        print(f"{org:32s} kept {kept} RNA-seq studies")

    rows.sort(key=lambda r: (r["organism"], r["accession"]))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["accession", "organism", "kegg_org", "assay", "title", "factors", "release"])
        w.writeheader()
        w.writerows(rows)
    print(f"\nTotal plant RNA-seq studies: {len(rows)} -> {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
