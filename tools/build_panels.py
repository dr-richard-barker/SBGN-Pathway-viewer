#!/usr/bin/env python3
"""
Generate static "panel figures" for each significant study x KEGG-pathway pair:
the study's data projected onto the KEGG pathway image (pathview-style overlay)
next to a heatmap of that pathway's significant loci (log2FC, red +ve / white 0 /
blue -ve). Writes PNGs to book/_static/panels/ and a JSON index that build_book.py
embeds into each study page — so readers see the results without the interactive app.

Run:  python tools/build_panels.py   (offline; fetches KEGG images, caches them)
"""
import csv, json, os, re, urllib.request
import xml.etree.ElementTree as ET
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
from matplotlib.colors import TwoSlopeNorm
import matplotlib.image as mpimg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(ROOT, "book")
KGML_DIR = os.path.join(BOOK, "data", "kgml")
IMG_DIR = os.path.join(BOOK, "data", "kegg_img")
PANELS_DIR = os.path.join(BOOK, "_static", "panels")
SLIM_DIR = os.path.join(ROOT, "public", "osdr")
MATRIX = os.path.join(BOOK, "data", "pathway_projection_matrix.csv")
MANIFEST = os.path.join(SLIM_DIR, "manifest.json")
INDEX = os.path.join(BOOK, "data", "panels_index.json")

SIG_THRESHOLD = 3       # min significant genes for a pathway to get a panel
LFC_CUT, PADJ_CUT = 1.0, 0.05
MAX_HEAT_LOCI = 40
CMAP = plt.get_cmap("RdBu_r")   # red = +ve, white = 0, blue = -ve


def kegg_image(pid):
    os.makedirs(IMG_DIR, exist_ok=True)
    path = os.path.join(IMG_DIR, f"{pid}.png")
    if not os.path.exists(path):
        url = f"https://rest.kegg.jp/get/{pid}/image"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "osdr-panels/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                open(path, "wb").write(r.read())
        except Exception:
            return None
    return path


def gene_nodes(kgml_path):
    """[(cx, cy, w, h, [loci])] for gene/ortholog entries."""
    out = []
    try:
        root = ET.parse(kgml_path).getroot()
    except Exception:
        return out
    for e in root.iter("entry"):
        if e.get("type") not in ("gene", "ortholog"):
            continue
        g = e.find("graphics")
        if g is None or g.get("x") is None:
            continue
        loci = [t.split(":", 1)[1] if ":" in t else t for t in (e.get("name") or "").split()]
        out.append((float(g.get("x")), float(g.get("y")),
                    float(g.get("width", 46)), float(g.get("height", 17)),
                    [l.upper() for l in loci]))
    return out


def load_slim(path):
    data = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                data[row["gene_id"].strip().upper()] = (
                    float(row["log2FoldChange"]), float(row.get("padj") or "nan"))
            except Exception:
                pass
    return data


def build(only=None):
    matrix = list(csv.DictReader(open(MATRIX, encoding="utf-8")))
    manifest = {d["osd"]: d for d in json.load(open(MANIFEST, encoding="utf-8"))["datasets"]}
    os.makedirs(PANELS_DIR, exist_ok=True)
    if os.path.exists(INDEX) and not only:
        pass
    index = json.load(open(INDEX, encoding="utf-8")) if (only and os.path.exists(INDEX)) else {}
    for r in matrix:
        if int(r["n_sig"]) < SIG_THRESHOLD:
            continue
        if only and r["accession"] not in only:
            continue
        acc, pid, name = r["accession"], r["kegg_pathway"], r["pathway_name"]
        ds = manifest.get(acc)
        if not ds or not ds.get("keggOrg"):
            continue
        kgml = os.path.join(KGML_DIR, f"{pid}.kgml")
        img = kegg_image(pid)
        if not os.path.exists(kgml) or not img:
            continue
        data = load_slim(os.path.join(SLIM_DIR, ds["file"]))
        nodes = gene_nodes(kgml)

        # node value = mean log2FC of its mapped loci
        node_vals = []
        heat = {}   # locus -> lfc (significant only)
        for cx, cy, w, h, loci in nodes:
            vals = [data[l][0] for l in loci if l in data]
            if vals:
                node_vals.append((cx, cy, w, h, float(np.mean(vals))))
            for l in loci:
                if l in data:
                    lfc, padj = data[l]
                    if abs(lfc) > LFC_CUT and (padj == padj and padj < PADJ_CUT):
                        heat[l] = lfc
        if not node_vals:
            continue

        vmax = max(1e-6, max(abs(v) for *_ , v in node_vals))
        norm = TwoSlopeNorm(vcenter=0.0, vmin=-vmax, vmax=vmax)

        im = mpimg.imread(img)
        ih, iw = im.shape[0], im.shape[1]
        heat_items = sorted(heat.items(), key=lambda kv: kv[1])[:MAX_HEAT_LOCI] if len(heat) <= MAX_HEAT_LOCI \
            else sorted(heat.items(), key=lambda kv: -abs(kv[1]))[:MAX_HEAT_LOCI]
        heat_items = sorted(heat_items, key=lambda kv: kv[1])
        nrow = max(1, len(heat_items))

        fig_h = max(3.2, min(0.26 * nrow + 1.4, ih / 80))
        map_w = max(4.0, iw / 80)
        fig = plt.figure(figsize=(map_w + 2.7, fig_h))
        gs = fig.add_gridspec(1, 2, width_ratios=[map_w, 2.3], wspace=0.02)
        axm = fig.add_subplot(gs[0, 0]); axh = fig.add_subplot(gs[0, 1])

        # --- map panel (opaque, outlined boxes so the overlay reads clearly) ---
        axm.imshow(im); axm.axis("off")
        for cx, cy, w, h, v in node_vals:
            axm.add_patch(Rectangle((cx - w / 2, cy - h / 2), w, h,
                                    facecolor=CMAP(norm(v)), edgecolor="#111", linewidth=0.6, alpha=0.92))
        axm.set_title(f"{acc} · {name}", fontsize=9)

        # --- heatmap panel ---
        if heat_items:
            col = np.array([[v] for _, v in heat_items])
            hvmax = max(1e-6, max(abs(v) for _, v in heat_items))
            hn = TwoSlopeNorm(vcenter=0.0, vmin=-hvmax, vmax=hvmax)
            axh.imshow(col, aspect="auto", cmap=CMAP, norm=hn)
            axh.set_xticks([])
            axh.set_yticks(range(len(heat_items)))
            axh.set_yticklabels([k for k, _ in heat_items], fontsize=6.5)
            axh.yaxis.tick_right()
            axh.set_title(f"sig. loci (n={len(heat)})", fontsize=8)
            cb = fig.colorbar(plt.cm.ScalarMappable(norm=hn, cmap=CMAP), ax=axh,
                              fraction=0.12, pad=0.35)
            cb.set_label("log2FC", fontsize=7); cb.ax.tick_params(labelsize=6)
        else:
            axh.axis("off")

        png = f"{acc}_{pid}.png"
        fig.savefig(os.path.join(PANELS_DIR, png), dpi=96, bbox_inches="tight")
        plt.close(fig)
        index.setdefault(acc, []).append(
            {"pid": pid, "name": name, "png": png, "n_sig": int(r["n_sig"]), "n_mapped": len(node_vals)})
        print(f"{acc} {pid} {name}: {len(node_vals)} nodes, {len(heat)} sig loci")

    for acc in index:
        index[acc].sort(key=lambda p: -p["n_sig"])
    json.dump(index, open(INDEX, "w", encoding="utf-8"), indent=1)
    total = sum(len(v) for v in index.values())
    print(f"\n{total} panels across {len(index)} studies -> {os.path.relpath(INDEX, ROOT)}")


if __name__ == "__main__":
    import sys
    only = set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None
    build(only)
