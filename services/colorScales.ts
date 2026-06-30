/**
 * Deterministic color scales for mapping omics values onto pathway glyphs.
 * No external dependencies — pure RGB interpolation so the app stays self-contained.
 */

export type ScaleKind = 'divergent' | 'gene-sequential' | 'compound-sequential';

interface RGB { r: number; g: number; b: number; }

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: RGB): string => {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};

const lerp = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

/** Piecewise-linear interpolation across an array of color stops. */
const rampColor = (stops: string[], t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  if (stops.length === 1) return stops[0];
  const scaled = clamped * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const localT = scaled - i;
  return rgbToHex(lerp(hexToRgb(stops[i]), hexToRgb(stops[i + 1]), localT));
};

// ColorBrewer-derived palettes.
const DIVERGENT_STOPS = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b']; // blue → white → red
const GENE_SEQ_STOPS = ['#ffffcc', '#c2e699', '#78c679', '#31a354', '#006837', '#54278f']; // light yellow → green → purple
const COMPOUND_SEQ_STOPS = ['#e5f5f9', '#99d8c9', '#41ae76', '#006d6f']; // light green → dark teal

export interface ColorScale {
  kind: ScaleKind;
  /** Returns a fill color for a value, or null if value is non-finite. */
  color: (value: number) => string | null;
  domainMin: number;
  domainMax: number;
  /** Sample colors left→right for rendering a legend gradient. */
  legendStops: string[];
  label: string;
}

const sampleStops = (fn: (t: number) => string, n = 12): string[] =>
  Array.from({ length: n }, (_, i) => fn(i / (n - 1)));

/**
 * Build a divergent scale symmetric around zero (for log2 fold-change).
 * maxAbs sets the saturation point in both directions.
 */
export const divergentScale = (maxAbs: number, label = 'log2 fold change'): ColorScale => {
  const m = maxAbs > 0 ? maxAbs : 1;
  const map = (t: number) => rampColor(DIVERGENT_STOPS, t);
  return {
    kind: 'divergent',
    color: (v) => (Number.isFinite(v) ? map((v + m) / (2 * m)) : null),
    domainMin: -m,
    domainMax: m,
    legendStops: sampleStops(map),
    label,
  };
};

/** Build a sequential scale over [min, max] (for counts / abundance). */
export const sequentialScale = (
  min: number,
  max: number,
  kind: 'gene-sequential' | 'compound-sequential',
  label: string
): ColorScale => {
  const stops = kind === 'gene-sequential' ? GENE_SEQ_STOPS : COMPOUND_SEQ_STOPS;
  const span = max - min;
  const map = (t: number) => rampColor(stops, t);
  return {
    kind,
    color: (v) => (Number.isFinite(v) ? map(span > 0 ? (v - min) / span : 0.5) : null),
    domainMin: min,
    domainMax: max,
    legendStops: sampleStops(map),
    label,
  };
};
