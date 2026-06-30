/**
 * Deterministic SBGN-ML (Process Description) → SVG renderer.
 *
 * SBGN-ML files (e.g. from Reactome) embed full layout geometry — every glyph
 * has an absolute <bbox> and every arc has explicit start/next/end points — so
 * rendering is a faithful, reproducible translation rather than an LLM guess.
 *
 * Omics values are overlaid via the shared ./overlay module: matched glyphs are
 * filled from a color scale and tagged with `glyph-gene-<ID>` / `glyph-compound-<ID>`
 * ids (and data-omics-* attrs) so MainPanel's hover-tooltip and search keep working.
 */

import { type VisualizationConfig } from '../types';
import { type DataMap, buildOverlay, entityAttrs, xmlEscape, textOn } from './overlay';

export interface RenderOptions {
  geneData: DataMap;
  compoundData: DataMap;
  config: VisualizationConfig;
  /** KGML image-overlay mode only: KEGG's pathway PNG as a portable data URL + dims. */
  backgroundImage?: { dataUrl: string; width: number; height: number };
}

// ---------------------------------------------------------------------------
// DOM helpers (namespace-agnostic: SBGN ML 0.2 / 0.3 use different NS URIs)
// ---------------------------------------------------------------------------

const directChildren = (el: Element, localName: string): Element[] => {
  const out: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (c.localName === localName) out.push(c);
  }
  return out;
};

const firstChild = (el: Element, localName: string): Element | null =>
  directChildren(el, localName)[0] ?? null;

interface Bbox { x: number; y: number; w: number; h: number; }

const readBbox = (el: Element): Bbox | null => {
  const b = firstChild(el, 'bbox');
  if (!b) return null;
  const x = parseFloat(b.getAttribute('x') || 'NaN');
  const y = parseFloat(b.getAttribute('y') || 'NaN');
  const w = parseFloat(b.getAttribute('w') || 'NaN');
  const h = parseFloat(b.getAttribute('h') || 'NaN');
  if (![x, y, w, h].every(Number.isFinite)) return null;
  return { x, y, w, h };
};

const readLabel = (el: Element): string => (firstChild(el, 'label')?.getAttribute('text') || '').trim();

// ---------------------------------------------------------------------------
// Glyph geometry / shapes
// ---------------------------------------------------------------------------

const GENE_CLASSES = new Set(['macromolecule', 'macromolecule multimer', 'nucleic acid feature', 'nucleic acid feature multimer']);
const COMPOUND_CLASSES = new Set(['simple chemical', 'simple chemical multimer']);
const AMBIGUOUS_CLASSES = new Set(['unspecified entity', 'complex', 'complex multimer']);
const PROCESS_CLASSES = new Set(['process', 'omitted process', 'uncertain process', 'association', 'dissociation']);
const LOGIC_CLASSES = new Set(['and', 'or', 'not']);
const SUBGLYPH_CLASSES = new Set(['state variable', 'unit of information']);

const roundedRect = (b: Bbox, fill: string, stroke: string, sw: number, r = 8): string =>
  `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${Math.min(r, b.h / 2)}" ry="${Math.min(r, b.h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

const ellipse = (b: Bbox, fill: string, stroke: string, sw: number): string =>
  `<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

const stadium = (b: Bbox, fill: string, stroke: string, sw: number): string =>
  roundedRect(b, fill, stroke, sw, b.h / 2);

const cutCornerRect = (b: Bbox, fill: string, stroke: string, sw: number): string => {
  const c = Math.min(12, b.w / 4, b.h / 4);
  const { x, y, w, h } = b;
  const pts = [
    [x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c],
    [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c],
  ].map((p) => p.join(',')).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
};

const bottomRoundedRect = (b: Bbox, fill: string, stroke: string, sw: number): string => {
  const r = Math.min(10, b.w / 3, b.h / 2);
  const { x, y, w, h } = b;
  const d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} Z`;
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
};

const hexagon = (b: Bbox, fill: string, stroke: string, sw: number): string => {
  const { x, y, w, h } = b;
  const c = w * 0.2;
  const pts = [
    [x + c, y], [x + w - c, y], [x + w, y + h / 2], [x + w - c, y + h], [x + c, y + h], [x, y + h / 2],
  ].map((p) => p.join(',')).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
};

const wrapLabel = (label: string, b: Bbox, fontSize: number): string[] => {
  if (!label) return [];
  const maxChars = Math.max(4, Math.floor(b.w / (fontSize * 0.58)));
  if (label.length <= maxChars) return [label];
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= maxChars) cur += ' ' + word;
    else { lines.push(cur); cur = word; }
    if (lines.length >= 2) break;
  }
  if (cur && lines.length < 3) lines.push(cur);
  return lines.slice(0, 3).map((l) => (l.length > maxChars + 2 ? l.slice(0, maxChars + 1) + '…' : l));
};

const labelText = (label: string, b: Bbox, fontSize: number, color: string): string => {
  const lines = wrapLabel(label, b, fontSize);
  if (lines.length === 0) return '';
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const lh = fontSize * 1.05;
  const startY = cy - ((lines.length - 1) * lh) / 2;
  const tspans = lines
    .map((ln, i) => `<tspan x="${cx}" y="${startY + i * lh + fontSize * 0.35}">${xmlEscape(ln)}</tspan>`)
    .join('');
  return `<text text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${color}">${tspans}</text>`;
};

// ---------------------------------------------------------------------------
// Arc rendering
// ---------------------------------------------------------------------------

interface Pt { x: number; y: number; }

const readPoint = (el: Element | null): Pt | null => {
  if (!el) return null;
  const x = parseFloat(el.getAttribute('x') || 'NaN');
  const y = parseFloat(el.getAttribute('y') || 'NaN');
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
};

const arrowHead = (type: string, tip: Pt, angle: number, color: string): string => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const tx = (d: number, o: number) => tip.x - d * cos - o * sin;
  const ty = (d: number, o: number) => tip.y - d * sin + o * cos;
  switch (type) {
    case 'production': {
      const p = `${tip.x},${tip.y} ${tx(11, 5)},${ty(11, 5)} ${tx(11, -5)},${ty(11, -5)}`;
      return `<polygon points="${p}" fill="${color}" stroke="${color}" stroke-width="1"/>`;
    }
    case 'stimulation':
    case 'necessary stimulation': {
      const p = `${tip.x},${tip.y} ${tx(12, 6)},${ty(12, 6)} ${tx(12, -6)},${ty(12, -6)}`;
      const bar = type === 'necessary stimulation'
        ? `<line x1="${tx(14, 7)}" y1="${ty(14, 7)}" x2="${tx(14, -7)}" y2="${ty(14, -7)}" stroke="${color}" stroke-width="2"/>`
        : '';
      return `<polygon points="${p}" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>${bar}`;
    }
    case 'catalysis': {
      const cx = tip.x - 6 * cos;
      const cy = tip.y - 6 * sin;
      return `<circle cx="${cx}" cy="${cy}" r="6" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`;
    }
    case 'inhibition':
      return `<line x1="${tx(2, 8)}" y1="${ty(2, 8)}" x2="${tx(2, -8)}" y2="${ty(2, -8)}" stroke="${color}" stroke-width="2.5"/>`;
    case 'modulation': {
      const p = `${tip.x},${tip.y} ${tx(7, 5)},${ty(7, 5)} ${tx(14, 0)},${ty(14, 0)} ${tx(7, -5)},${ty(7, -5)}`;
      return `<polygon points="${p}" fill="#ffffff" stroke="${color}" stroke-width="1.5"/>`;
    }
    default:
      return '';
  }
};

const renderArc = (arc: Element, config: VisualizationConfig): string => {
  const cls = (arc.getAttribute('class') || '').toLowerCase().trim();
  const start = readPoint(firstChild(arc, 'start'));
  const end = readPoint(firstChild(arc, 'end'));
  if (!start || !end) return '';
  const nexts = directChildren(arc, 'next').map(readPoint).filter((p): p is Pt => !!p);
  const pts = [start, ...nexts, end];
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const color = config.arcLineColor;
  const sw = config.arcLineWidth;
  const dash = cls === 'inhibition' || cls === 'modulation' ? ' stroke-dasharray="4 3"' : '';
  const line = `<path d="${path}" fill="none" stroke="${color}" stroke-width="${sw}"${dash}/>`;

  const prev = pts[pts.length - 2];
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
  return line + arrowHead(cls, end, angle, color);
};

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

export const renderSbgnToSvg = (sbgnXml: string, options: RenderOptions): string => {
  const { config, geneData, compoundData } = options;
  const doc = new DOMParser().parseFromString(sbgnXml, 'application/xml');

  if (doc.getElementsByTagName('parsererror')[0]) {
    throw new Error('The SBGN file could not be parsed as XML. Please check the file is valid SBGN-ML.');
  }

  const glyphEls = Array.from(doc.getElementsByTagNameNS('*', 'glyph'));
  const arcEls = Array.from(doc.getElementsByTagNameNS('*', 'arc'));
  if (glyphEls.length === 0) {
    throw new Error('No SBGN glyphs were found in this map. The pathway may be empty or in an unsupported format.');
  }

  const overlay = buildOverlay(config, geneData, compoundData);

  interface G { cls: string; bbox: Bbox; label: string; area: number; }
  const all: G[] = [];
  for (const el of glyphEls) {
    const bbox = readBbox(el);
    if (!bbox) continue;
    const cls = (el.getAttribute('class') || '').toLowerCase().trim();
    all.push({ cls, bbox, label: readLabel(el), area: bbox.w * bbox.h });
  }

  const compartments = all.filter((g) => g.cls === 'compartment').sort((a, b) => b.area - a.area);
  const subGlyphs = all.filter((g) => SUBGLYPH_CLASSES.has(g.cls));
  const mainGlyphs = all
    .filter((g) => g.cls !== 'compartment' && !SUBGLYPH_CLASSES.has(g.cls))
    .sort((a, b) => b.area - a.area); // containers (complexes) behind their contents

  // Bounds over glyphs + arc endpoints.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const g of all) {
    minX = Math.min(minX, g.bbox.x); minY = Math.min(minY, g.bbox.y);
    maxX = Math.max(maxX, g.bbox.x + g.bbox.w); maxY = Math.max(maxY, g.bbox.y + g.bbox.h);
  }
  for (const a of arcEls) {
    for (const ln of ['start', 'end']) {
      const p = readPoint(firstChild(a, ln));
      if (p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    }
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const pad = 40;
  const vbX = minX - pad, vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2 + overlay.legendHeight;

  const sw = 1.2;
  const fontSize = config.glyphFontSize;
  const parts: string[] = [`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#f8fafc"/>`];

  // Compartments (background).
  for (const g of compartments) {
    parts.push(`<g>${roundedRect(g.bbox, 'rgba(226,232,240,0.55)', '#94a3b8', 2, 14)}`);
    if (g.label) {
      parts.push(`<text x="${g.bbox.x + g.bbox.w / 2}" y="${g.bbox.y + g.bbox.h - 8}" text-anchor="middle" font-family="'Segoe UI', Helvetica, Arial, sans-serif" font-size="${fontSize + 2}" font-weight="700" fill="#64748b" opacity="0.8">${xmlEscape(g.label)}</text>`);
    }
    parts.push('</g>');
  }

  // Arcs.
  for (const a of arcEls) parts.push(renderArc(a, config));

  // Main glyphs.
  for (const g of mainGlyphs) {
    const { bbox: b, cls, label } = g;
    let fill = config.glyphFillColor;
    let idAttr = '', dataAttrs = '';

    const tryGene = GENE_CLASSES.has(cls) || AMBIGUOUS_CLASSES.has(cls);
    const tryCompound = COMPOUND_CLASSES.has(cls) || AMBIGUOUS_CLASSES.has(cls);
    const hit = tryGene || tryCompound ? overlay.match(label, { gene: tryGene, compound: tryCompound }) : null;
    if (hit) {
      const a = entityAttrs(hit);
      idAttr = a.idAttr; dataAttrs = a.dataAttrs;
      if (hit.fill) fill = hit.fill;
    }

    let shape = '';
    if (GENE_CLASSES.has(cls)) {
      shape = cls.startsWith('nucleic') ? bottomRoundedRect(b, fill, '#334155', sw) : roundedRect(b, fill, '#334155', sw);
    } else if (COMPOUND_CLASSES.has(cls)) {
      shape = stadium(b, fill, '#334155', sw);
    } else if (cls === 'unspecified entity') {
      shape = ellipse(b, fill, '#334155', sw);
    } else if (cls === 'complex' || cls === 'complex multimer') {
      shape = cutCornerRect(b, hit ? fill : 'rgba(203,213,225,0.45)', '#334155', sw);
    } else if (cls === 'phenotype') {
      shape = hexagon(b, '#fde68a', '#92400e', sw);
    } else if (PROCESS_CLASSES.has(cls) || LOGIC_CLASSES.has(cls)) {
      if (cls === 'association') shape = ellipse(b, '#334155', '#334155', sw);
      else if (cls === 'dissociation') shape = ellipse(b, '#ffffff', '#334155', sw) + ellipse({ x: b.x + b.w * 0.25, y: b.y + b.h * 0.25, w: b.w * 0.5, h: b.h * 0.5 }, 'none', '#334155', sw);
      else shape = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff" stroke="#334155" stroke-width="${sw}"/>`;
    } else if (cls === 'source and sink') {
      shape = ellipse(b, '#ffffff', '#334155', sw) + `<line x1="${b.x}" y1="${b.y + b.h}" x2="${b.x + b.w}" y2="${b.y}" stroke="#334155" stroke-width="${sw}"/>`;
    } else if (cls === 'tag') {
      shape = roundedRect(b, fill, '#334155', sw, 3);
    } else {
      shape = roundedRect(b, fill, '#334155', sw);
    }

    const showLabel = !PROCESS_CLASSES.has(cls) || LOGIC_CLASSES.has(cls);
    const text = showLabel ? labelText(LOGIC_CLASSES.has(cls) ? cls.toUpperCase() : label, b, fontSize, textOn(fill)) : '';
    const cursor = idAttr ? ' style="cursor:pointer"' : '';
    parts.push(`<g${idAttr}${dataAttrs}${cursor}>${shape}${text}</g>`);
  }

  // Sub-glyphs (state variables, units of information) on top.
  for (const g of subGlyphs) {
    const { bbox: b, cls, label } = g;
    const small = Math.max(7, fontSize - 2);
    if (cls === 'state variable') {
      parts.push(`<g>${stadium(b, '#ffffff', '#475569', 0.8)}${label ? labelText(label, b, small, '#334155') : ''}</g>`);
    } else {
      parts.push(`<g><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#f1f5f9" stroke="#475569" stroke-width="0.8"/>${label ? labelText(label, b, small, '#334155') : ''}</g>`);
    }
  }

  if (overlay.hasData) parts.push(overlay.legendSvg(vbX + 16, maxY + pad + 4, 220));

  const mapName = doc.getElementsByTagNameNS('*', 'map')[0]?.getAttribute('name') || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" font-family="'Segoe UI', Helvetica, Arial, sans-serif">` +
    (mapName ? `<title>${xmlEscape(mapName)}</title>` : '') +
    parts.join('') +
    `</svg>`;
};
