#!/usr/bin/env python3
"""
Generate static "panel figures" for each significant study x KEGG-pathway pair.

Each panel is a two-part figure:
  LEFT  — a clean, ggpathway-style node-link diagram of the pathway, drawn from the
          KGML topology (KEGG's own node coordinates + <relation> edges). Gene nodes
          are coloured by the study's log2FC (red +ve / white 0 / blue -ve), the
          significant ones are labelled with their gene symbol. This is far clearer
          than overlaying the dense KEGG reference image.
  RIGHT — a heatmap of the pathway's significant loci (log2FC, same red/white/blue),
          labelled by gene symbol, with human-optimised spacing.

Writes PNGs to book/_static/panels/ and a JSON index consumed by build_book.py.
Pure Python (matplotlib) — no KEGG image download, no R dependency.

Run:  python tools/build_panels.py [OSD-###,OSD-###]
"""
import csv, json, os, re, sys
import xml.etree.ElementTree as ET

LOCUS_RE = re.compile(r"^AT[1-5MC]G\d{5}$", re.I)   # an AGI locus, not a real symbol
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import FancyBboxPatch, Circle, Rectangle
from matplotlib.colors import TwoSlopeNorm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(ROOT, "book")
KGML_DIR = os.path.join(BOOK, "data", "kgml")
PANELS_DIR = os.path.join(BOOK, "_static", "panels")
SLIM_DIR = os.path.join(ROOT, "public", "osdr")
MATRIX = os.path.join(BOOK, "data", "pathway_projection_matrix.csv")
MANIFEST = os.path.join(SLIM_DIR, "manifest.json")
INDEX = os.path.join(BOOK, "data", "panels_index.json")

SIG_THRESHOLD = 3
LFC_CUT, PADJ_CUT = 1.0, 0.05
MAX_HEAT_LOCI = 40
CMAP = plt.get_cmap("RdBu_r")   # red = +ve, white = 0, blue = -ve


def sym(name):
    """First gene symbol from a KGML graphics name ('ERS2, ETR2...' -> 'ERS2')."""
    return (name or "").split(",")[0].replace("...", "").strip()


def parse_kgml(path):
    """entries: id -> dict(type, loci, symbol, x, y, w, h); edges: [(id1,id2)]."""
    root = ET.parse(path).getroot()
    entries, edges = {}, []
    for e in root.iter("entry"):
        g = e.find("graphics")
        if g is None or g.get("x") is None:
            continue
        loci = [t.split(":", 1)[1].upper() if ":" in t else t.upper() for t in (e.get("name") or "").split()]
        entries[e.get("id")] = {
            "type": e.get("type"), "loci": loci, "symbol": sym(g.get("name")),
            "x": float(g.get("x")), "y": float(g.get("y")),
            "w": float(g.get("width", 46)), "h": float(g.get("height", 17)),
        }
    for rel in root.iter("relation"):
        a, b = rel.get("entry1"), rel.get("entry2")
        if a in entries and b in entries:
            edges.append((a, b))
    for rxn in root.iter("reaction"):
        enz = rxn.get("id")
        subs = [s.get("id") for s in rxn.findall("substrate")]
        prods = [p.get("id") for p in rxn.findall("product")]
        for s in subs:
            if s in entries and enz in entries: edges.append((s, enz))
        for p in prods:
            if p in entries and enz in entries: edges.append((enz, p))
    return entries, edges


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


def draw_graph(ax, entries, edges, data, norm, sig_labels, region=None, label_size=5.5):
    """Clean node-link pathway diagram coloured by log2FC.
    sig_labels = [(x, y, text)] for significant genes (always labelled).
    region = (x0, x1, y0, y1) zooms to that window so labels become legible."""
    xs = [e["x"] for e in entries.values()]
    ys = [e["y"] for e in entries.values()]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    if region:
        x0, x1, y0, y1 = region
        ax.set_xlim(x0, x1); ax.set_ylim(y1, y0)   # inverted y
    else:
        ax.set_xlim(minx - 40, maxx + 40); ax.set_ylim(maxy + 30, miny - 30)
    ax.set_aspect("equal"); ax.axis("off")

    # edges first (light grey)
    for a, b in edges:
        ea, eb = entries[a], entries[b]
        ax.plot([ea["x"], eb["x"]], [ea["y"], eb["y"]], color="#c8ccd2", lw=0.6, zorder=1)

    # nodes: genes (coloured), compounds (dots), pathway-map links (faint)
    for e in entries.values():
        t = e["type"]
        val = next((data[l][0] for l in e["loci"] if l in data), None)
        if t == "compound":
            ax.add_patch(Circle((e["x"], e["y"]), 4, facecolor="#eef0f2",
                                 edgecolor="#94a3b8", lw=0.4, zorder=2))
            continue
        if t == "map":
            ax.add_patch(FancyBboxPatch((e["x"] - e["w"] / 2, e["y"] - e["h"] / 2), e["w"], e["h"],
                         boxstyle="round,pad=1,rounding_size=4", facecolor="#eaf1fb",
                         edgecolor="#b6c6e0", lw=0.4, zorder=2))
            continue
        if t not in ("gene", "ortholog"):
            continue
        fc = CMAP(norm(val)) if val is not None else "#eceff2"
        ax.add_patch(FancyBboxPatch((e["x"] - e["w"] / 2, e["y"] - e["h"] / 2), e["w"], e["h"],
                     boxstyle="round,pad=1,rounding_size=3", facecolor=fc,
                     edgecolor="#334155", lw=0.5, zorder=3))
    # significant genes: red ring + label (symbol, else locus) so they are always
    # findable even on a dense map.
    for x, y, s in sig_labels:
        ax.add_patch(Circle((x, y), 13, fill=False, edgecolor="#e11d48", lw=0.9, zorder=3.6))
    for x, y, s in sig_labels:
        ax.annotate(s, (x, y - 12), fontsize=label_size, ha="center", va="bottom", zorder=4,
                    color="#0f172a",
                    bbox=dict(boxstyle="round,pad=0.1", fc="white", ec="#e2e8f0", lw=0.3, alpha=0.9))


def build(only=None):
    matrix = list(csv.DictReader(open(MATRIX, encoding="utf-8")))
    manifest = {d["osd"]: d for d in json.load(open(MANIFEST, encoding="utf-8"))["datasets"]}
    os.makedirs(PANELS_DIR, exist_ok=True)
    index = json.load(open(INDEX, encoding="utf-8")) if (only and os.path.exists(INDEX)) else {}

    for r in matrix:
        if int(r["n_sig"]) < SIG_THRESHOLD:
            continue
        acc, pid, name = r["accession"], r["kegg_pathway"], r["pathway_name"]
        if only and acc not in only:
            continue
        ds = manifest.get(acc)
        kgml = os.path.join(KGML_DIR, f"{pid}.kgml")
        if not ds or not os.path.exists(kgml):
            continue
        entries, edges = parse_kgml(kgml)
        if not entries:
            continue
        data = load_slim(os.path.join(SLIM_DIR, ds["file"]))

        # locus -> symbol only when UNAMBIGUOUS: a single-locus node with a real
        # symbol (KEGG bundles gene families under one node/label, which would
        # otherwise mislabel every member locus with the family's display name).
        loc2sym, heat = {}, {}
        for e in entries.values():
            # KEGG's node label is the symbol of its FIRST gene id; only that locus
            # gets it (avoids mislabelling every member of a bundled gene family).
            if e["loci"]:
                l, s = e["loci"][0], e["symbol"]
                if s and not LOCUS_RE.match(s) and l not in loc2sym:
                    loc2sym[l] = s
        for e in entries.values():
            for l in e["loci"]:
                if l in data:
                    lfc, padj = data[l]
                    if abs(lfc) > LFC_CUT and padj == padj and padj < PADJ_CUT:
                        heat[l] = lfc
        vmax = max(1e-6, max((abs(data[l][0]) for e in entries.values() for l in e["loci"] if l in data), default=1))
        norm = TwoSlopeNorm(vcenter=0.0, vmin=-vmax, vmax=vmax)

        items = sorted(heat.items(), key=lambda kv: kv[1])
        if len(items) > MAX_HEAT_LOCI:
            items = sorted(sorted(heat.items(), key=lambda kv: -abs(kv[1]))[:MAX_HEAT_LOCI], key=lambda kv: kv[1])
        nrow = max(1, len(items))

        # Significant-gene coordinates + whether to add a zoom sub-panel: only for
        # BUSY pathways whose significant genes sit in a sub-region (else the full
        # graph is already legible or the zoom would just repeat it).
        sig_labels = []
        for e in entries.values():
            if e["type"] not in ("gene", "ortholog"):
                continue
            hits = [(l, data[l][0]) for l in e["loci"]
                    if l in data and abs(data[l][0]) > LFC_CUT and data[l][1] == data[l][1] and data[l][1] < PADJ_CUT]
            if hits:
                locus = max(hits, key=lambda kv: abs(kv[1]))[0]   # strongest sig locus in this node
                sig_labels.append((e["x"], e["y"], loc2sym.get(locus, locus)))
        # one label per unique gene (the same locus can appear in several KEGG nodes)
        _seen, _dedup = set(), []
        for x, y, lab in sig_labels:
            if lab not in _seen:
                _seen.add(lab); _dedup.append((x, y, lab))
        sig_labels = _dedup
        sig_pts = [(x, y) for x, y, _ in sig_labels]
        n_gene = sum(1 for e in entries.values() if e["type"] in ("gene", "ortholog"))
        allx = [e["x"] for e in entries.values()]; ally = [e["y"] for e in entries.values()]
        full_area = max(1, (max(allx) - min(allx)) * (max(ally) - min(ally)))
        region = None
        if n_gene >= 55 and len(sig_pts) >= 2:
            sx = [p[0] for p in sig_pts]; sy = [p[1] for p in sig_pts]
            pad = 55
            x0, x1, y0, y1 = min(sx) - pad, max(sx) + pad, min(sy) - pad, max(sy) + pad
            # enforce a minimum window and skip if the region ~ the whole map
            if (x1 - x0) * (y1 - y0) < 0.55 * full_area:
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                half_w, half_h = max((x1 - x0) / 2, 90), max((y1 - y0) / 2, 70)
                region = (cx - half_w, cx + half_w, cy - half_h, cy + half_h)

        fig_h = max(3.6, min(0.25 * nrow + 1.6, 9))
        if region:
            fig = plt.figure(figsize=(12.6, fig_h))
            gs = fig.add_gridspec(1, 3, width_ratios=[6.2, 3.6, 2.6], wspace=0.05)
            axg = fig.add_subplot(gs[0, 0]); axz = fig.add_subplot(gs[0, 1]); axh = fig.add_subplot(gs[0, 2])
        else:
            fig = plt.figure(figsize=(10.2, fig_h))
            gs = fig.add_gridspec(1, 2, width_ratios=[7.4, 2.8], wspace=0.06)
            axg = fig.add_subplot(gs[0, 0]); axz = None; axh = fig.add_subplot(gs[0, 1])

        # Full map always marks significant genes (ring + label). When they cluster,
        # a zoom sub-panel adds legibility.
        draw_graph(axg, entries, edges, data, norm, sig_labels, label_size=5.0)
        axg.set_title(f"{acc} · {name}", fontsize=10)
        if region:
            axg.add_patch(Rectangle((region[0], region[2]), region[1] - region[0], region[3] - region[2],
                                    fill=False, edgecolor="#e11d48", lw=1.0, ls="--", zorder=5))
            draw_graph(axz, entries, edges, data, norm, sig_labels, region=region, label_size=8)
            axz.set_title("significant-gene region", fontsize=9)

        if items:
            col = np.array([[v] for _, v in items])
            hv = max(1e-6, max(abs(v) for _, v in items))
            hn = TwoSlopeNorm(vcenter=0.0, vmin=-hv, vmax=hv)
            axh.imshow(col, aspect="auto", cmap=CMAP, norm=hn)
            axh.set_xticks([])
            axh.set_yticks(range(len(items)))
            axh.set_yticklabels([loc2sym.get(k, k) for k, _ in items], fontsize=6.5)
            axh.yaxis.tick_right()
            axh.set_title(f"significant loci (n={len(heat)})", fontsize=8)
            cb = fig.colorbar(plt.cm.ScalarMappable(norm=hn, cmap=CMAP), ax=axh, fraction=0.12, pad=0.5)
            cb.set_label("log2FC", fontsize=7); cb.ax.tick_params(labelsize=6)
        else:
            axh.axis("off")

        png = f"{acc}_{pid}.png"
        fig.savefig(os.path.join(PANELS_DIR, png), dpi=150, bbox_inches="tight")
        plt.close(fig)
        index.setdefault(acc, []).append(
            {"pid": pid, "name": name, "png": png, "n_sig": int(r["n_sig"])})
        print(f"{acc} {pid} {name}: {len(entries)} nodes, {len(edges)} edges, {len(heat)} sig loci")

    for acc in index:
        index[acc].sort(key=lambda p: -p["n_sig"])
    json.dump(index, open(INDEX, "w", encoding="utf-8"), indent=1)
    print(f"\n{sum(len(v) for v in index.values())} panels across {len(index)} studies")


if __name__ == "__main__":
    build(set(sys.argv[1].split(",")) if len(sys.argv) > 1 else None)
