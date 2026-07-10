#!/usr/bin/env python3
"""Holistic subcellular views of the pathway-level spaceflight response:
  1. a Sankey (pathway -> cellular compartment, weighted by significant-gene events)
     as a static PNG (matplotlib) and an interactive HTML (plotly),
  2. a pathway<->compartment network (networkx PNG), and
  3. a graph-database export (GraphML + Neo4j nodes/edges CSV + import Cypher) of the
     Gene / Pathway / Compartment / Study knowledge graph.
Inputs already computed: book/data/pathway_compartment.tsv, ath_compartments_all.tsv,
pathway_projection_matrix.csv, KGML, slim tables.
"""
import csv, json, os, re, math
import xml.etree.ElementTree as ET
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path
import matplotlib.patches as mpatches
import networkx as nx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOOK = os.path.join(ROOT, "book"); DATA = os.path.join(BOOK, "data")
STATIC = os.path.join(BOOK, "_static"); SLIM = os.path.join(ROOT, "public", "osdr")
GDB = os.path.join(ROOT, "graph_db")
LOCUS = re.compile(r"^AT[1-5MC]G\d{5}$", re.I)

COMP_PAL = {
    "Nucleus": "#6a3d9a", "Chloroplast": "#33a02c", "Mitochondrion": "#e31a1c",
    "Endoplasmic reticulum": "#ff7f00", "Golgi": "#b15928", "Plasma membrane": "#1f78b4",
    "Vacuole": "#a6cee3", "Peroxisome": "#fb9a99", "Cell wall / apoplast": "#b2df8a",
    "Cytoplasm": "#fdbf6f", "Membrane (unspecified)": "#cab2d6"}
SKIP = {"Other / unknown"}


def relabel(c):
    return "Membrane (unspecified)" if c == "Membrane" else c


def load_comp():
    d = {}
    for r in csv.DictReader(open(os.path.join(DATA, "ath_compartments_all.tsv"), encoding="utf-8"), delimiter="\t"):
        d[r["locus"].upper()] = relabel(r["compartment"])
    return d


def load_flows():
    flows = {}
    for r in csv.DictReader(open(os.path.join(DATA, "pathway_compartment.tsv"), encoding="utf-8"), delimiter="\t"):
        c = relabel(r["compartment"])
        if c in SKIP:
            continue
        flows[(r["pathway"], c)] = flows.get((r["pathway"], c), 0) + int(r["sig_events"])
    return flows


# ---------- 1. Sankey ----------
def sankey_png(flows):
    paths = sorted({p for p, _ in flows}, key=lambda p: -sum(v for (pp, _), v in flows.items() if pp == p))
    comps = [c for c in COMP_PAL if any(cc == c for (_, cc) in flows)]
    ptot = {p: sum(v for (pp, _), v in flows.items() if pp == p) for p in paths}
    ctot = {c: sum(v for (_, cc), v in flows.items() if cc == c) for c in comps}
    total = sum(ptot.values())
    gap = total * 0.02
    fig, ax = plt.subplots(figsize=(11, 7)); ax.axis("off")
    ax.set_xlim(0, 1); ax.set_ylim(0, total + gap * max(len(paths), len(comps)))

    def stack(items, tot, x):
        y = 0; pos = {}
        for k in items:
            h = tot[k]; pos[k] = (y, y + h); y += h + gap
        return pos, y
    lp, lh = stack(paths, ptot, 0); rp, rh = stack(comps, ctot, 1)
    off = (max(lh, rh) - lh) / 2; lp = {k: (a + off, b + off) for k, (a, b) in lp.items()}
    off = (max(lh, rh) - rh) / 2; rp = {k: (a + off, b + off) for k, (a, b) in rp.items()}
    for p in paths:
        ax.add_patch(mpatches.Rectangle((0.0, lp[p][0]), 0.022, lp[p][1] - lp[p][0], color="#555", ec="none"))
        ax.text(-0.01, sum(lp[p]) / 2, p, ha="right", va="center", fontsize=7)
    for c in comps:
        ax.add_patch(mpatches.Rectangle((0.978, rp[c][0]), 0.022, rp[c][1] - rp[c][0], color=COMP_PAL[c], ec="none"))
        ax.text(1.01, sum(rp[c]) / 2, c, ha="left", va="center", fontsize=7.5)
    lcur = {p: lp[p][0] for p in paths}; rcur = {c: rp[c][0] for c in comps}
    for p in paths:
        for c in comps:
            v = flows.get((p, c), 0)
            if not v:
                continue
            y0a, y0b = lcur[p], lcur[p] + v; lcur[p] = y0b
            y1a, y1b = rcur[c], rcur[c] + v; rcur[c] = y1b
            verts = [(0.022, y0a), (0.5, y0a), (0.5, y1a), (0.978, y1a),
                     (0.978, y1b), (0.5, y1b), (0.5, y0b), (0.022, y0b), (0.022, y0a)]
            codes = [Path.MOVETO, Path.CURVE4, Path.CURVE4, Path.LINETO,
                     Path.LINETO, Path.CURVE4, Path.CURVE4, Path.LINETO, Path.CLOSEPOLY]
            ax.add_patch(mpatches.PathPatch(Path(verts, codes), facecolor=COMP_PAL[c], alpha=0.5, ec="none"))
    ax.set_title("Where pathway changes act: significant genes by pathway → cellular compartment", fontsize=10)
    fig.savefig(os.path.join(STATIC, "sankey_pathway_compartment.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


def sankey_html(flows):
    try:
        import plotly.graph_objects as go
    except Exception:
        return
    paths = sorted({p for p, _ in flows})
    comps = [c for c in COMP_PAL if any(cc == c for (_, cc) in flows)]
    labels = paths + comps
    idx = {l: i for i, l in enumerate(labels)}
    src = [idx[p] for (p, c) in flows]; tgt = [idx[c] for (p, c) in flows]; val = list(flows.values())
    ncol = ["#888"] * len(paths) + [COMP_PAL[c] for c in comps]
    lcol = [COMP_PAL[c] + "88" if False else "rgba(120,120,120,0.35)" for (p, c) in flows]
    fig = go.Figure(go.Sankey(
        node=dict(label=labels, color=ncol, pad=12, thickness=12),
        link=dict(source=src, target=tgt, value=val, color=lcol)))
    fig.update_layout(title="Pathway → cellular compartment (significant genes)", font_size=11, height=650)
    fig.write_html(os.path.join(STATIC, "sankey_pathway_compartment.html"), include_plotlyjs=True, full_html=True)


# ---------- 2. Network ----------
def network_png(flows):
    G = nx.Graph()
    for (p, c), v in flows.items():
        G.add_node(("P", p), kind="pathway"); G.add_node(("C", c), kind="compartment")
        G.add_edge(("P", p), ("C", c), weight=v)
    paths = [n for n in G if n[0] == "P"]; comps = [n for n in G if n[0] == "C"]
    pos = {}
    for i, n in enumerate(sorted(paths)):
        pos[n] = (0.0, i - len(paths) / 2)
    for i, n in enumerate(sorted(comps)):
        pos[n] = (3.0, (i - len(comps) / 2) * (len(paths) / max(1, len(comps))))
    fig, ax = plt.subplots(figsize=(11, 8)); ax.axis("off")
    for u, v, d in G.edges(data=True):
        p = u if u[0] == "P" else v; c = v if v[0] == "C" else u
        x0, y0 = pos[p]; x1, y1 = pos[c]
        ax.plot([x0, x1], [y0, y1], color=COMP_PAL.get(c[1], "#ccc"),
                alpha=0.45, linewidth=0.3 + 2.6 * d["weight"] / max(e[2]["weight"] for e in G.edges(data=True)))
    for n in paths:
        ax.scatter(*pos[n], s=90, color="#555", zorder=3)
        ax.text(pos[n][0] - 0.08, pos[n][1], n[1], ha="right", va="center", fontsize=7)
    for n in comps:
        deg = sum(d["weight"] for _, _, d in G.edges(n, data=True))
        ax.scatter(*pos[n], s=60 + deg * 0.9, color=COMP_PAL.get(n[1], "#ccc"), zorder=3, edgecolors="#333")
        ax.text(pos[n][0] + 0.1, pos[n][1], n[1], ha="left", va="center", fontsize=7.5)
    ax.set_title("Pathway ↔ compartment network (edge width ∝ significant genes)", fontsize=10)
    fig.savefig(os.path.join(STATIC, "pathway_compartment_network.png"), dpi=150, bbox_inches="tight")
    plt.close(fig)


# ---------- 3. Graph-database export ----------
def graph_db():
    comp = load_comp()
    man = {d["osd"]: d for d in json.load(open(os.path.join(SLIM, "manifest.json"), encoding="utf-8"))["datasets"]}
    matrix = list(csv.DictReader(open(os.path.join(DATA, "pathway_projection_matrix.csv"), encoding="utf-8")))
    ploci = {}
    for pid in {r["kegg_pathway"] for r in matrix}:
        p = os.path.join(DATA, "kgml", pid + ".kgml")
        if not os.path.exists(p):
            continue
        s = set()
        for e in ET.parse(p).getroot().iter("entry"):
            if e.get("type") in ("gene", "ortholog"):
                for t in (e.get("name") or "").split():
                    l = (t.split(":", 1)[1] if ":" in t else t).upper()
                    if LOCUS.match(l):
                        s.add(l)
        ploci[pid] = s
    pname = {r["kegg_pathway"]: r["pathway_name"] for r in matrix}

    G = nx.MultiDiGraph()
    slim = {}
    genes = set()
    for r in matrix:
        if int(r["n_sig"]) < 3:
            continue
        acc, pid = r["accession"], r["kegg_pathway"]
        ds = man.get(acc)
        if not ds or pid not in ploci:
            continue
        if acc not in slim:
            dd = {}
            for row in csv.DictReader(open(os.path.join(SLIM, ds["file"]), encoding="utf-8")):
                try:
                    dd[row["gene_id"].upper()] = (float(row["log2FoldChange"]), float(row["padj"]))
                except Exception:
                    pass
            slim[acc] = dd
        G.add_node("S:" + acc, kind="Study", name=acc)
        G.add_node("P:" + pid, kind="Pathway", name=pname[pid])
        for l in ploci[pid]:
            v = slim[acc].get(l)
            if v and abs(v[0]) > 1 and v[1] < 0.05:
                genes.add(l)
                G.add_node("G:" + l, kind="Gene", name=l)
                G.add_edge("G:" + l, "P:" + pid, rel="IN_PATHWAY")
                G.add_edge("G:" + l, "S:" + acc, rel="DE_IN", log2FC=round(v[0], 3), padj=v[1])
    for l in genes:
        c = comp.get(l, "Other / unknown")
        G.add_node("C:" + c, kind="Compartment", name=c)
        G.add_node("G:" + l, kind="Gene", name=l)
        G.add_edge("G:" + l, "C:" + c, rel="LOCATED_IN")

    os.makedirs(GDB, exist_ok=True)
    nx.write_graphml(G, os.path.join(GDB, "spaceflight_atlas.graphml"))
    # Neo4j-style nodes/edges CSV
    with open(os.path.join(GDB, "nodes.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["id:ID", "label:LABEL", "name"])
        for n, d in G.nodes(data=True):
            w.writerow([n, d.get("kind", "Node"), d.get("name", n)])
    with open(os.path.join(GDB, "edges.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow([":START_ID", ":END_ID", ":TYPE", "log2FC:float", "padj:float"])
        for u, v, d in G.edges(data=True):
            w.writerow([u, v, d.get("rel", "REL"), d.get("log2FC", ""), d.get("padj", "")])
    cy = """// Load the spaceflight subcellular atlas into Neo4j.
// Place nodes.csv and edges.csv in the DBMS import/ folder, then run:
LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS r
CALL apoc.create.node([r.`label:LABEL`], {id:r.`id:ID`, name:r.name}) YIELD node RETURN count(*);
CREATE INDEX IF NOT EXISTS FOR (n:Gene) ON (n.id);
LOAD CSV WITH HEADERS FROM 'file:///edges.csv' AS r
MATCH (a {id:r.`:START_ID`}), (b {id:r.`:END_ID`})
CALL apoc.create.relationship(a, r.`:TYPE`, {log2FC:toFloat(r.`log2FC:float`), padj:toFloat(r.`padj:float`)}, b)
YIELD rel RETURN count(*);
// Example: which compartments do a pathway's spaceflight-responsive genes sit in?
// MATCH (p:Pathway)<-[:IN_PATHWAY]-(g:Gene)-[:LOCATED_IN]->(c:Compartment)
// RETURN p.name, c.name, count(DISTINCT g) ORDER BY count(DISTINCT g) DESC;
"""
    open(os.path.join(GDB, "import.cypher"), "w", encoding="utf-8").write(cy)
    open(os.path.join(GDB, "README.md"), "w", encoding="utf-8").write(
        "# Spaceflight subcellular knowledge graph\n\n"
        f"Nodes: {G.number_of_nodes()} (Gene/Pathway/Compartment/Study), edges: {G.number_of_edges()} "
        "(IN_PATHWAY, LOCATED_IN, DE_IN).\n\n"
        "- `spaceflight_atlas.graphml` — open in Cytoscape / Gephi / yEd.\n"
        "- `nodes.csv`, `edges.csv`, `import.cypher` — load into Neo4j (needs APOC).\n")
    print(f"graph-db: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges -> graph_db/")


if __name__ == "__main__":
    os.makedirs(STATIC, exist_ok=True)
    flows = load_flows()
    sankey_png(flows); sankey_html(flows); network_png(flows); graph_db()
    print("done")
