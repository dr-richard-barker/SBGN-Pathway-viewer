/**
 * Resolves the pathway source for a visualization request — entirely without
 * any AI / Google AI Studio dependency. Returns the raw markup plus its format
 * so the caller can pick the right renderer.
 *
 *  - Reactome  : fetches the real, layout-complete SBGN export for the pathway.
 *  - KEGG      : fetches the pathway's KGML (KEGG's own layout markup).
 *  - Custom    : uses the user-uploaded SBGN file verbatim.
 *  - Demo      : a bundled offline SBGN map (works with no network).
 *  - Others    : databases that publish neither SBGN-ML nor KGML are reported
 *                clearly, with guidance to upload a custom SBGN file instead.
 */

import { type VisualizationConfig, type PathwayDatabase } from '../types';
import { DEMO_SBGN } from './demoSbgn';

const REACTOME_EXPORTER = 'https://reactome.org/ContentService/exporter/event';
const KEGG_GET = 'https://rest.kegg.jp/get';

// Free, no-key CORS proxy used only as a fallback / for no-CORS hosts (KEGG).
// allorigins requires the target URL to be percent-encoded.
const proxify = (url: string): string => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

const looksLikeSbgn = (t: string): boolean => /<\s*sbgn[\s>]/i.test(t) || /<\s*map[\s>]/i.test(t);
const looksLikeKgml = (t: string): boolean => /<\s*pathway[\s>]/i.test(t) && /<\s*entry[\s>]/i.test(t);

export type PathwayFormat = 'sbgn' | 'kgml';
export interface PathwaySource { format: PathwayFormat; content: string; }

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'application/xml, text/xml, */*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Try a direct fetch first, then fall back through the CORS proxy. */
async function fetchWithProxyFallback(url: string, validate: (t: string) => boolean): Promise<string> {
  let text = '';
  try {
    text = await fetchText(url);
    if (validate(text)) return text;
  } catch {
    /* fall through to proxy */
  }
  text = await fetchText(proxify(url));
  return text;
}

/** Reactome publishes SBGN for any event/pathway stable id (e.g. R-HSA-1640170). */
async function fetchReactomeSbgn(stId: string): Promise<string> {
  const url = `${REACTOME_EXPORTER}/${encodeURIComponent(stId)}.sbgn`;
  const text = await fetchWithProxyFallback(url, looksLikeSbgn);
  if (!looksLikeSbgn(text)) {
    throw new Error(
      `Reactome did not return an SBGN map for "${stId}". Some high-level pathways are not exported as SBGN — try a more specific sub-pathway, or upload a custom SBGN file.`
    );
  }
  return text;
}

/** KEGG publishes KGML for every pathway, e.g. ath00010 → /get/ath00010/kgml. */
async function fetchKeggKgml(pathwayId: string): Promise<string> {
  const id = pathwayId.replace(/^path:/, '');
  const url = `${KEGG_GET}/${encodeURIComponent(id)}/kgml`;
  // KEGG sends no CORS headers, so this almost always needs the proxy.
  const text = await fetchWithProxyFallback(url, looksLikeKgml);
  if (!looksLikeKgml(text)) {
    throw new Error(
      `KEGG did not return KGML for "${id}". The CORS proxy may be unavailable — retry, or upload a custom SBGN file.`
    );
  }
  return text;
}

export interface KeggImage { dataUrl: string; width: number; height: number; }

/**
 * Fetches KEGG's official pathway diagram (PNG) and returns it as a self-contained
 * data URL plus natural dimensions, for the pathview-style image-overlay mode.
 * KEGG's KGML coordinates are in this image's pixel space, so an exact overlay is
 * possible. The PNG is embedded (not linked) so the downloaded SVG stays portable.
 */
export async function fetchKeggImage(pathwayId: string): Promise<KeggImage> {
  const id = pathwayId.replace(/^path:/, '');
  const url = `${KEGG_GET}/${encodeURIComponent(id)}/image`;
  const res = await fetch(proxify(url));
  if (!res.ok) throw new Error(`Could not fetch the KEGG image for "${id}" (HTTP ${res.status}).`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/') && blob.size < 1000) {
    throw new Error(`KEGG did not return an image for "${id}". The proxy may be unavailable.`);
  }
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read the KEGG image.'));
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to decode the KEGG image.'));
    img.src = dataUrl;
  });
  return { dataUrl, ...dims };
}

const DBS_WITHOUT_SOURCE: Record<string, string> = {
  MetaCyc: 'MetaCyc/BioCyc does not provide a public SBGN-ML export. Upload an SBGN file via "Custom SBGN File".',
  SMPDB: 'SMPDB does not provide SBGN-ML. Upload an SBGN file via "Custom SBGN File".',
  PANTHER: 'PANTHER does not provide SBGN-ML. Upload an SBGN file via "Custom SBGN File".',
  METACROP: 'MetaCrop does not provide a public SBGN-ML export. Upload an SBGN file via "Custom SBGN File".',
};

export interface SbgnRequest {
  config: VisualizationConfig;
  customSbgnFile: string | null;
  /** When true, ignore the database and return the bundled offline demo map. */
  useDemo?: boolean;
}

/** Returns the pathway source (markup + format), or throws a user-readable error. */
export async function getPathwaySource({ config, customSbgnFile, useDemo }: SbgnRequest): Promise<PathwaySource> {
  if (useDemo) return { format: 'sbgn', content: DEMO_SBGN };

  const db: PathwayDatabase = config.pathwayDatabase;

  if (db === 'Custom SBGN File') {
    if (!customSbgnFile || !looksLikeSbgn(customSbgnFile)) {
      throw new Error('Please upload a valid SBGN-ML (.sbgn / .xml) file.');
    }
    return { format: 'sbgn', content: customSbgnFile };
  }

  if (db === 'Reactome') {
    if (!config.pathwayId) throw new Error('Please select a Reactome pathway.');
    return { format: 'sbgn', content: await fetchReactomeSbgn(config.pathwayId) };
  }

  if (db === 'KEGG') {
    if (!config.pathwayId) throw new Error('Please select a KEGG pathway.');
    return { format: 'kgml', content: await fetchKeggKgml(config.pathwayId) };
  }

  const msg = DBS_WITHOUT_SOURCE[db];
  throw new Error(
    msg ?? `Standalone rendering supports Reactome, KEGG and custom SBGN files. For ${db}, upload a custom SBGN file.`
  );
}
