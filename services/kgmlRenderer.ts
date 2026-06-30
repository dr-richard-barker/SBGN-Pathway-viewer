/**
 * Deterministic KGML (KEGG Markup Language) → SVG renderer.
 *
 * KEGG publishes KGML for every pathway, and — like SBGN-ML — it embeds layout
 * geometry: each <entry> has a <graphics> element with a center (x, y), width and
 * height, plus <reaction>/<relation> connectivity. This lets us draw a faithful,
 * reproducible KEGG-style map in the browser and overlay omics data on it, with
 * no AI and no KEGG account.
 *
 * NOTE: KEGG graphics coordinates are the CENTER of a node (SBGN bboxes are the
 * top-left corner), so we convert with x - w/2, y - h/2.
 *
 * Data overlay is shared with the SBGN renderer via ./overlay.
 */

import { buildOverlay, entityAttrs, xmlEscape, textOn } from './overlay';
import { type RenderOptions } from './sbgnRenderer';

interface Graphics { x: number; y: number; w: number; h: number; type: string; name: string; bgcolor: string; coords: number[]; }
interface Entry { id: string; type: string; name: string; reaction: string; g: Graphics | null; }

const num = (s: string | null, d = NaN): number => {
  const n = parseFloat(s ?? '');
  return Number.isFinite(n) ? n : d;
};

const readGraphics = (entry: Element): Graphics | null => {
  const g = entry.getElementsByTagName('graphics')[0];
  if (!g) return null;
  const coords = (g.getAttribute('coords') || '')
    .split(',')
    .map((v) => parseFloat(v))
    .filter((v) => Number.isFinite(v));
  return {
    x: num(g.getAttribute('x')),
    y: num(g.getAttribute('y')),
    w: num(g.getAttribute('width'), 46),
    h: num(g.getAttribute('height'), 17),
    type: (g.getAttribute('type') || 'rectangle').toLowerCase(),
    name: (g.getAttribute('name') || '').trim(),
    bgcolor: g.getAttribute('bgcolor') || '',
    coords,
  };
};

// KEGG entry.name is space-separated db ids, e.g. "ath:AT1G12345 ath:AT2G..." or
// "cpd:C00031". Strip the db prefix so user Entrez / locus / KEGG ids can match.
const strippedIds = (name: string): string[] =>
  name.split(/\s+/).map((t) => (t.includes(':') ? t.slice(t.indexOf(':') + 1) : t)).filter(Boolean);

// A label/candidate string fed to the overlay matcher: graphics symbols + raw ids.
const matchCandidates = (e: Entry): string =>
  `${e.g?.name || ''} ${strippedIds(e.name).join(' ')}`;

// First human-readable token for display (KEGG packs synonyms after commas).
const displayLabel = (e: Entry): string => {
  const raw = e.g?.name || strippedIds(e.name)[0] || e.name;
  return raw.split(',')[0].replace(/\.\.\.$/, '').trim();
};

const center = (g: Graphics) => ({ x: g.x, y: g.y });

const truncLabel = (label: string, w: number, fontSize: number, x: number, y: number, color: string): string => {
  if (!label) return '';
  const maxChars = Math.max(3, Math.floor(w / (fontSize * 0.6)));
  const shown = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label;
  return `<text x="${x}" y="${y + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize}" fill="${color}">${xmlEscape(shown)}</text>`;
};

const tinyArrow = (from: { x: number; y: number }, to: { x: number; y: number }, color: string): string => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const tx = (d: number, o: number) => to.x - d * cos - o * sin;
  const ty = (d: number, o: number) => to.y - d * sin + o * cos;
  return `<polygon points="${to.x},${to.y} ${tx(8, 4)},${ty(8, 4)} ${tx(8, -4)},${ty(8, -4)}" fill="${color}"/>`;
};

export const renderKgmlToSvg = (kgmlXml: string, options: RenderOptions): string => {
  const { config, geneData, compoundData } = options;
  const doc = new DOMParser().parseFromString(kgmlXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror')[0]) {
    throw new Error('The KEGG KGML file could not be parsed as XML.');
  }

  const entryEls = Array.from(doc.getElementsByTagName('entry'));
  if (entryEls.length === 0) {
    throw new Error('No KEGG entries were found in this pathway. Try a different KEGG pathway, or upload a custom SBGN file.');
  }

  const entries = new Map<string, Entry>();
  for (const el of entryEls) {
    const e: Entry = {
      id: el.getAttribute('id') || '',
      type: (el.getAttribute('type') || '').toLowerCase(),
      name: el.getAttribute('name') || '',
      reaction: el.getAttribute('reaction') || '',
      g: readGraphics(el),
    };
    if (e.id) entries.set(e.id, e);
  }

  const overlay = buildOverlay(config, geneData, compoundData);

  // --- Image-overlay (pathview-style) mode --------------------------------
  // Draw KEGG's official pathway PNG and lay translucent data colors over the
  // matched gene boxes / compound circles (KGML coords are image-pixel coords).
  if (options.backgroundImage) {
    const { dataUrl, width, height } = options.backgroundImage;
    const legendH = overlay.legendHeight;
    const vbH = height + (legendH ? legendH + 16 : 0);
    const layers: string[] = [
      `<rect x="0" y="0" width="${width}" height="${vbH}" fill="#ffffff"/>`,
      `<image x="0" y="0" width="${width}" height="${height}" href="${dataUrl}" preserveAspectRatio="xMidYMid meet"/>`,
    ];
    for (const e of entries.values()) {
      const g = e.g;
      if (!g || !Number.isFinite(g.x) || e.type === 'group' || e.type === 'map' || g.type === 'line') continue;
      const isCompound = e.type === 'compound';
      const hit = overlay.match(matchCandidates(e), isCompound ? { compound: true } : { gene: true });
      if (!hit || !hit.fill) continue;
      const a = entityAttrs(hit);
      if (isCompound) {
        const r = Math.max(5, Math.min(g.w, g.h) / 2);
        layers.push(`<g${a.idAttr}${a.dataAttrs} style="cursor:pointer"><circle cx="${g.x}" cy="${g.y}" r="${r}" fill="${hit.fill}" fill-opacity="0.7" stroke="#0f172a" stroke-width="1"/></g>`);
      } else {
        layers.push(`<g${a.idAttr}${a.dataAttrs} style="cursor:pointer"><rect x="${g.x - g.w / 2}" y="${g.y - g.h / 2}" width="${g.w}" height="${g.h}" fill="${hit.fill}" fill-opacity="0.6" stroke="#0f172a" stroke-width="1"/></g>`);
      }
    }
    if (overlay.hasData) layers.push(overlay.legendSvg(8, height + 8, 220));
    const titleImg = doc.getElementsByTagName('pathway')[0]?.getAttribute('title') || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${vbH}" font-family="'Segoe UI', Helvetica, Arial, sans-serif">` +
      (titleImg ? `<title>${xmlEscape(titleImg)}</title>` : '') +
      layers.join('') +
      `</svg>`;
  }

  // Bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  for (const e of entries.values()) {
    const g = e.g;
    if (!g || !Number.isFinite(g.x)) continue;
    if (g.type === 'line' && g.coords.length >= 2) {
      for (let i = 0; i + 1 < g.coords.length; i += 2) grow(g.coords[i], g.coords[i + 1]);
    } else {
      grow(g.x - g.w / 2, g.y - g.h / 2);
      grow(g.x + g.w / 2, g.y + g.h / 2);
    }
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const pad = 40;
  const vbX = minX - pad, vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2 + overlay.legendHeight;

  const fontSize = config.glyphFontSize;
  const arcColor = config.arcLineColor;
  const arcW = config.arcLineWidth;
  const parts: string[] = [`<rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#f8fafc"/>`];

  // --- Backbone lines (drawn under nodes) ---------------------------------
  // Relations (signaling edges).
  for (const rel of Array.from(doc.getElementsByTagName('relation'))) {
    const a = entries.get(rel.getAttribute('entry1') || '');
    const b = entries.get(rel.getAttribute('entry2') || '');
    if (a?.g && b?.g && Number.isFinite(a.g.x) && Number.isFinite(b.g.x)) {
      const p1 = center(a.g), p2 = center(b.g);
      parts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${arcColor}" stroke-width="${arcW}" opacity="0.45"/>`);
    }
  }
  // Reactions (metabolic: substrate -> enzyme -> product).
  for (const rxn of Array.from(doc.getElementsByTagName('reaction'))) {
    const enzyme = entries.get(rxn.getAttribute('id') || '');
    const ec = enzyme?.g && Number.isFinite(enzyme.g.x) ? center(enzyme.g) : null;
    const subs = Array.from(rxn.getElementsByTagName('substrate'));
    const prods = Array.from(rxn.getElementsByTagName('product'));
    for (const s of subs) {
      const se = entries.get(s.getAttribute('id') || '');
      if (se?.g && Number.isFinite(se.g.x)) {
        const p = center(se.g), to = ec ?? p;
        parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${to.x}" y2="${to.y}" stroke="${arcColor}" stroke-width="${arcW}"/>`);
      }
    }
    for (const pr of prods) {
      const pe = entries.get(pr.getAttribute('id') || '');
      if (pe?.g && Number.isFinite(pe.g.x)) {
        const p = center(pe.g), from = ec ?? p;
        parts.push(`<line x1="${from.x}" y1="${from.y}" x2="${p.x}" y2="${p.y}" stroke="${arcColor}" stroke-width="${arcW}"/>`);
        if (ec) parts.push(tinyArrow(from, p, arcColor));
      }
    }
  }

  // --- Nodes ---------------------------------------------------------------
  // Groups (complex containers) behind their members.
  for (const e of entries.values()) {
    if (e.type !== 'group' || !e.g || !Number.isFinite(e.g.x)) continue;
    const { x, y, w, h } = e.g;
    parts.push(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6" fill="rgba(203,213,225,0.4)" stroke="#94a3b8" stroke-width="1"/>`);
  }

  for (const e of entries.values()) {
    const g = e.g;
    if (!g || !Number.isFinite(g.x) || e.type === 'group') continue;

    // "line"-typed graphics (e.g. reaction connectors drawn as polylines).
    if (g.type === 'line') {
      if (g.coords.length >= 4) {
        let d = '';
        for (let i = 0; i + 1 < g.coords.length; i += 2) {
          d += `${i === 0 ? 'M' : 'L'} ${g.coords[i]} ${g.coords[i + 1]} `;
        }
        parts.push(`<path d="${d.trim()}" fill="none" stroke="#64748b" stroke-width="${Math.max(1, arcW)}"/>`);
      }
      continue;
    }

    const cx = g.x, cy = g.y;
    const x = cx - g.w / 2, y = cy - g.h / 2;

    if (e.type === 'compound') {
      const hit = overlay.match(matchCandidates(e), { compound: true });
      let fill = '#ffffff';
      let idAttr = '', dataAttrs = '';
      if (hit) {
        const a = entityAttrs(hit); idAttr = a.idAttr; dataAttrs = a.dataAttrs;
        if (hit.fill) fill = hit.fill;
      }
      const r = Math.max(5, Math.min(g.w, g.h) / 2);
      const cursor = idAttr ? ' style="cursor:pointer"' : '';
      const lbl = hit ? truncLabel(displayLabel(e), Math.max(g.w, 40), Math.max(8, fontSize - 1), cx, cy + r + fontSize, '#334155') : '';
      parts.push(`<g${idAttr}${dataAttrs}${cursor}><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#334155" stroke-width="1"/>${lbl}</g>`);
      continue;
    }

    if (e.type === 'map') {
      parts.push(`<g><rect x="${x}" y="${y}" width="${g.w}" height="${g.h}" rx="8" fill="#dbeafe" stroke="#3b82f6" stroke-width="1"/>${truncLabel(displayLabel(e), g.w, fontSize, cx, cy, '#1e3a8a')}</g>`);
      continue;
    }

    // gene / ortholog / enzyme (and anything else) -> rectangle.
    const hit = overlay.match(matchCandidates(e), { gene: true });
    let fill = config.glyphFillColor;
    let idAttr = '', dataAttrs = '';
    if (hit) {
      const a = entityAttrs(hit); idAttr = a.idAttr; dataAttrs = a.dataAttrs;
      if (hit.fill) fill = hit.fill;
    }
    const cursor = idAttr ? ' style="cursor:pointer"' : '';
    parts.push(`<g${idAttr}${dataAttrs}${cursor}><rect x="${x}" y="${y}" width="${g.w}" height="${g.h}" rx="2" fill="${fill}" stroke="#334155" stroke-width="1"/>${truncLabel(displayLabel(e), g.w, fontSize, cx, cy, textOn(fill))}</g>`);
  }

  if (overlay.hasData) parts.push(overlay.legendSvg(vbX + 16, maxY + pad + 4, 220));

  const title = doc.getElementsByTagName('pathway')[0]?.getAttribute('title') || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" font-family="'Segoe UI', Helvetica, Arial, sans-serif">` +
    (title ? `<title>${xmlEscape(title)}</title>` : '') +
    parts.join('') +
    `</svg>`;
};
