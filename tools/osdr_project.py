#!/usr/bin/env python3
"""
Project a slim gene table (gene_id,log2FoldChange,padj) onto a set of KEGG
pathways and compute per-pathway statistics. Shared by the batch pipeline and
usable standalone. Stdlib only; KGML is fetched from rest.kegg.jp and cached.
"""
import csv, os, re, urllib.request, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KGML_CACHE = os.path.join(ROOT, "book", "data", "kgml")

# Curated, space-biology-relevant pathways (KEGG map numbers; org prefix added).
DEFAULT_PATHWAYS = [
    ("00010", "Glycolysis / Gluconeogenesis"),
    ("00195", "Photosynthesis"),
    ("00196", "Photosynthesis - antenna proteins"),
    ("00710", "Carbon fixation (Calvin cycle)"),
    ("00500", "Starch and sucrose metabolism"),
    ("00940", "Phenylpropanoid biosynthesis"),
    ("00941", "Flavonoid biosynthesis"),
    ("00592", "alpha-Linolenic acid (jasmonate) metabolism"),
    ("00908", "Zeatin biosynthesis"),
    ("04075", "Plant hormone signal transduction"),
    ("04626", "Plant-pathogen interaction"),
    ("04712", "Circadian rhythm - plant"),
    ("00480", "Glutathione metabolism"),
    ("00360", "Phenylalanine metabolism"),
]


def fetch_kgml(kegg_org, number):
    pid = f"{kegg_org}{number}"
    os.makedirs(KGML_CACHE, exist_ok=True)
    path = os.path.join(KGML_CACHE, f"{pid}.kgml")
    if not os.path.exists(path):
        url = f"https://rest.kegg.jp/get/{pid}/kgml"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "osdr-project/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if b"<pathway" not in data:
                return None
            open(path, "wb").write(data)
        except Exception:
            return None
    return path


def pathway_gene_ids(path):
    """Return the set of gene identifiers in a KGML (org-prefix stripped)."""
    ids = set()
    try:
        root = ET.parse(path).getroot()
    except Exception:
        return ids
    for e in root.iter("entry"):
        if e.get("type") in ("gene", "ortholog"):
            for tok in (e.get("name") or "").split():
                ids.add(tok.split(":", 1)[1] if ":" in tok else tok)
    return ids


def load_slim(path):
    data = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                data[row["gene_id"].strip().upper()] = (
                    float(row["log2FoldChange"]),
                    float(row.get("padj") or "nan"),
                )
            except Exception:
                pass
    return data


def project(slim_path, kegg_org, pathways=DEFAULT_PATHWAYS, padj_cut=0.05, lfc_cut=1.0):
    """Yield a stats dict per pathway for the given slim table."""
    data = load_slim(slim_path)
    for number, name in pathways:
        kg = fetch_kgml(kegg_org, number)
        if not kg:
            continue
        loci = {i.upper() for i in pathway_gene_ids(kg)}
        mapped = [(l, data[l]) for l in loci if l in data]
        up = sum(1 for _, (lfc, _p) in mapped if lfc > lfc_cut)
        down = sum(1 for _, (lfc, _p) in mapped if lfc < -lfc_cut)
        sig = sum(1 for _, (lfc, p) in mapped if abs(lfc) > lfc_cut and (p == p and p < padj_cut))
        vals = [lfc for _, (lfc, _p) in mapped]
        mean_abs = sum(abs(v) for v in vals) / len(vals) if vals else 0.0
        yield {
            "kegg_pathway": f"{kegg_org}{number}",
            "pathway_name": name,
            "n_pathway_genes": len(loci),
            "n_mapped": len(mapped),
            "coverage_pct": round(100 * len(mapped) / len(loci), 1) if loci else 0,
            "n_up": up,
            "n_down": down,
            "n_sig": sig,
            "mean_abs_log2fc": round(mean_abs, 3),
        }


if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 3:
        sys.exit("usage: osdr_project.py <slim.csv> <kegg_org>")
    print(json.dumps(list(project(sys.argv[1], sys.argv[2])), indent=2))
