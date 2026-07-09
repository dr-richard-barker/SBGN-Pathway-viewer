#!/usr/bin/env python3
"""Fetch UniProt subcellular locations for the atlas's significant Arabidopsis loci
and bucket them into top-level cellular compartments. Writes
book/data/gene_compartments.tsv (locus, compartment, raw)."""
import csv, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCI = os.path.join(ROOT, "book", "data", "_sigloci.txt")
OUT = os.path.join(ROOT, "book", "data", "gene_compartments.tsv")

BUCKETS = [
    ("Nucleus", ["nucleus", "nuclear"]),
    ("Chloroplast", ["chloroplast", "plastid", "thylakoid"]),
    ("Mitochondrion", ["mitochond"]),
    ("Endoplasmic reticulum", ["endoplasmic reticulum"]),
    ("Golgi", ["golgi"]),
    ("Plasma membrane", ["cell membrane", "plasma membrane"]),
    ("Vacuole", ["vacuole", "tonoplast"]),
    ("Peroxisome", ["peroxisome", "glyoxysome"]),
    ("Cell wall / apoplast", ["cell wall", "apoplast", "extracellular", "secreted"]),
    ("Cytoplasm", ["cytoplasm", "cytosol"]),
    ("Membrane", ["membrane"]),
]


def bucket(text):
    t = text.lower()
    for name, keys in BUCKETS:
        if any(k in t for k in keys):
            return name
    return "Other / unknown"


def first_location(cc):
    # "SUBCELLULAR LOCATION: Nucleus {evidence}. Note=..." -> "Nucleus"
    m = re.search(r"SUBCELLULAR LOCATION:\s*(.*)", cc)
    if not m:
        return ""
    s = re.sub(r"\{[^}]*\}", "", m.group(1))
    s = s.split("Note=")[0]
    return re.split(r"[.;]", s)[0].strip()


def fetch_batch(loci):
    q = " OR ".join(f"gene:{l}" for l in loci)
    url = ("https://rest.uniprot.org/uniprotkb/search?query="
           + urllib.parse.quote(f"({q}) AND organism_id:3702")
           + "&fields=gene_oln,cc_subcellular_location&format=tsv&size=500")
    req = urllib.request.Request(url, headers={"User-Agent": "osdr-atlas/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def main():
    loci = [l.strip().upper() for l in open(LOCI) if l.strip()]
    result = {}
    for i in range(0, len(loci), 60):
        batch = loci[i:i + 60]
        try:
            tsv = fetch_batch(batch)
        except Exception as e:
            print("batch error", e); time.sleep(3); continue
        for row in csv.DictReader(tsv.splitlines(), delimiter="\t"):
            olns = (row.get("Gene Names (ordered locus)") or "").upper().split()
            cc = row.get("Subcellular location [CC]") or ""
            loc = first_location(cc)
            if not loc:
                continue
            for oln in olns:
                if oln in batch and oln not in result:
                    result[oln] = (bucket(loc), loc)
        print(f"{min(i+60,len(loci))}/{len(loci)} fetched, {len(result)} annotated")
        time.sleep(0.4)

    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["locus", "compartment", "location"])
        for l in loci:
            comp, raw = result.get(l, ("Other / unknown", ""))
            w.writerow([l, comp, raw])
    # coverage summary
    from collections import Counter
    c = Counter(result.get(l, ("Other / unknown",))[0] for l in loci)
    print(f"\nannotated {len(result)}/{len(loci)} ({100*len(result)//len(loci)}%)")
    for k, v in c.most_common():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
