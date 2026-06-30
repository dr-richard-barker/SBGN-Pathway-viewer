/**
 * Shared omics-overlay logic used by both the SBGN and KGML renderers:
 * value extraction, identifier→glyph matching, color-scale construction, and
 * the in-figure legend. Pure functions + strings, no external dependencies.
 */

import { type VisualizationConfig } from '../types';
import { type ColorScale, divergentScale, sequentialScale } from './colorScales';

export type DataMap = Map<string, Record<string, string>>;

// --- string helpers -------------------------------------------------------

export const xmlEscape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// `id`s also feed CSS selectors in MainPanel, so keep them selector-safe.
export const safeId = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '_');

/**
 * Pick a readable label color (near-black or white) for a given fill, using the
 * WCAG relative-luminance heuristic. Falls back to dark for non-hex fills.
 */
export const textOn = (bg: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(bg.trim());
  if (!m) return '#0f172a';
  const hex = m[1];
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(hex.substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  // 0.179 is the WCAG luminance crossover where black vs white text have equal
  // contrast; above it dark text wins, below it light text wins.
  return lum > 0.179 ? '#0f172a' : '#ffffff';
};

export const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(1);
  return (Math.round(n * 100) / 100).toString();
};

// --- value extraction -----------------------------------------------------

const FC_HEADER = /(log\s*2)?\s*fold|lfc|log2fc|log2foldchange/i;
const ID_HEADER = /^(id|gene|symbol|name|identifier|kegg|chebi|compound|metabolite)/i;
const STAT_HEADER = /padj|p\.?adj|pvalue|p\.?value|fdr|stat|^se$|lfcse/i;

const numericColumns = (record: Record<string, string>): number[] => {
  const vals: number[] = [];
  for (const [header, raw] of Object.entries(record)) {
    if (ID_HEADER.test(header) || STAT_HEADER.test(header)) continue;
    const n = parseFloat(raw);
    if (Number.isFinite(n)) vals.push(n);
  }
  return vals;
};

export const foldChangeValue = (record: Record<string, string>): number => {
  for (const [header, raw] of Object.entries(record)) {
    if (FC_HEADER.test(header)) {
      const n = parseFloat(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return NaN;
};

export const abundanceValue = (record: Record<string, string>): number => {
  const cols = numericColumns(record);
  if (cols.length === 0) return NaN;
  return cols.reduce((a, b) => a + b, 0) / cols.length;
};

// --- matching -------------------------------------------------------------

const normalize = (s: string): string => s.trim().toUpperCase();
const tokenize = (label: string): string[] =>
  label.split(/[^A-Za-z0-9_]+/).map((t) => t.trim()).filter(Boolean);

interface Lookup {
  byId: Map<string, { key: string; value: number }>;
  values: number[];
}

const buildLookup = (data: DataMap, pick: (r: Record<string, string>) => number): Lookup => {
  const byId = new Map<string, { key: string; value: number }>();
  const values: number[] = [];
  data.forEach((record, key) => {
    const value = pick(record);
    const norm = normalize(key);
    if (norm && !byId.has(norm)) {
      byId.set(norm, { key, value });
      if (Number.isFinite(value)) values.push(value);
    }
  });
  return { byId, values };
};

const matchLabel = (label: string, lookup: Lookup): { key: string; value: number } | null => {
  if (!label) return null;
  const whole = normalize(label);
  if (lookup.byId.has(whole)) return lookup.byId.get(whole)!;
  for (const tok of tokenize(label)) {
    const hit = lookup.byId.get(normalize(tok));
    if (hit) return hit;
  }
  return null;
};

// --- overlay --------------------------------------------------------------

export interface EntityHit {
  kind: 'gene' | 'compound';
  key: string;
  /** Fill color from the scale, or null if the matched value is non-finite. */
  fill: string | null;
}

export interface Overlay {
  hasData: boolean;
  legendHeight: number;
  /** Match a label to gene/compound data; increments mapped counts when colored. */
  match: (label: string, kinds: { gene?: boolean; compound?: boolean }) => EntityHit | null;
  legendSvg: (x: number, y: number, width: number) => string;
}

const maxAbs = (vals: number[]) => vals.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const minOf = (vals: number[]) => vals.reduce((m, v) => Math.min(m, v), Infinity);
const maxOf = (vals: number[]) => vals.reduce((m, v) => Math.max(m, v), -Infinity);

export const buildOverlay = (
  config: VisualizationConfig,
  geneData: DataMap,
  compoundData: DataMap
): Overlay => {
  const geneLookup = buildLookup(geneData, config.dataType === 'deseq2' ? foldChangeValue : abundanceValue);
  const compoundLookup = buildLookup(compoundData, config.compoundDataType === 'fold_change' ? foldChangeValue : abundanceValue);

  const geneScale: ColorScale | null = geneLookup.values.length
    ? config.dataType === 'deseq2'
      ? divergentScale(maxAbs(geneLookup.values), 'Gene log2 fold change')
      : sequentialScale(minOf(geneLookup.values), maxOf(geneLookup.values), 'gene-sequential', 'Gene abundance')
    : null;
  const compoundScale: ColorScale | null = compoundLookup.values.length
    ? config.compoundDataType === 'fold_change'
      ? divergentScale(maxAbs(compoundLookup.values), 'Compound log2 fold change')
      : sequentialScale(minOf(compoundLookup.values), maxOf(compoundLookup.values), 'compound-sequential', 'Compound abundance')
    : null;

  const counts = { gene: 0, compound: 0 };

  const match: Overlay['match'] = (label, kinds) => {
    if (kinds.gene && geneScale) {
      const m = matchLabel(label, geneLookup);
      if (m) {
        const fill = geneScale.color(m.value);
        if (fill) counts.gene++;
        return { kind: 'gene', key: m.key, fill };
      }
    }
    if (kinds.compound && compoundScale) {
      const m = matchLabel(label, compoundLookup);
      if (m) {
        const fill = compoundScale.color(m.value);
        if (fill) counts.compound++;
        return { kind: 'compound', key: m.key, fill };
      }
    }
    return null;
  };

  const activeScales = [geneScale, compoundScale].filter(Boolean) as ColorScale[];
  const legendHeight = activeScales.length ? activeScales.length * 46 + 24 : 0;

  const legendSvg: Overlay['legendSvg'] = (x, y, width) => {
    if (!activeScales.length) return '';
    const barW = 180, barH = 12, rowH = 46;
    let out = `<g font-family="'Segoe UI', Helvetica, Arial, sans-serif">`;
    out += `<rect x="${x}" y="${y}" width="${width}" height="${activeScales.length * rowH + 14}" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>`;
    activeScales.forEach((scale, i) => {
      const matched = scale === geneScale ? counts.gene : counts.compound;
      const ry = y + 14 + i * rowH;
      const gid = `lg${i}`;
      const stops = scale.legendStops
        .map((c, si) => `<stop offset="${(si / (scale.legendStops.length - 1)) * 100}%" stop-color="${c}"/>`)
        .join('');
      out += `<defs><linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="0%">${stops}</linearGradient></defs>`;
      out += `<text x="${x + 12}" y="${ry + 2}" font-size="11" font-weight="600" fill="#334155">${xmlEscape(scale.label)} (${matched} mapped)</text>`;
      out += `<rect x="${x + 12}" y="${ry + 8}" width="${barW}" height="${barH}" fill="url(#${gid})" stroke="#94a3b8" stroke-width="0.5"/>`;
      out += `<text x="${x + 12}" y="${ry + 34}" font-size="10" fill="#475569">${fmtNum(scale.domainMin)}</text>`;
      out += `<text x="${x + 12 + barW}" y="${ry + 34}" font-size="10" text-anchor="end" fill="#475569">${fmtNum(scale.domainMax)}</text>`;
    });
    out += `</g>`;
    return out;
  };

  return { hasData: activeScales.length > 0, legendHeight, match, legendSvg };
};

/** Build the id + data attributes for a matched entity group (shared by renderers). */
export const entityAttrs = (hit: EntityHit): { idAttr: string; dataAttrs: string } => ({
  idAttr: hit.fill ? ` id="glyph-${hit.kind}-${safeId(hit.key)}"` : '',
  dataAttrs: ` data-omics-kind="${hit.kind}" data-omics-id="${xmlEscape(hit.key)}"`,
});
