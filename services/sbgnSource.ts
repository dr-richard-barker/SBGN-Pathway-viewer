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
import { corsFetch, corsFetchText } from './proxy';

const REACTOME_EXPORTER = 'https://reactome.org/ContentService/exporter/event';
const KEGG_GET = 'https://rest.kegg.jp/get';

const looksLikeSbgn = (t: string): boolean => /<\s*sbgn[\s>]/i.test(t) || /<\s*map[\s>]/i.test(t);
const looksLikeKgml = (t: string): boolean => /<\s*pathway[\s>]/i.test(t) && /<\s*entry[\s>]/i.test(t);

export type PathwayFormat = 'sbgn' | 'kgml';
export interface PathwaySource { format: PathwayFormat; content: string; }

/** Reactome publishes SBGN for any event/pathway stable id (e.g. R-HSA-1640170). */
async function fetchReactomeSbgn(stId: string): Promise<string> {
  const url = `${REACTOME_EXPORTER}/${encodeURIComponent(stId)}.sbgn`;
  try {
    // Reactome is CORS-enabled, so a direct fetch normally works; proxies are a fallback.
    return await corsFetchText(url, looksLikeSbgn);
  } catch {
    throw new Error(
      `Reactome did not return an SBGN map for "${stId}". Some high-level pathways are not exported as SBGN — try a more specific sub-pathway, or upload a custom SBGN file.`
    );
  }
}

/** KEGG publishes KGML for every pathway, e.g. ath00010 → /get/ath00010/kgml. */
async function fetchKeggKgml(pathwayId: string): Promise<string> {
  const id = pathwayId.replace(/^path:/, '');
  const url = `${KEGG_GET}/${encodeURIComponent(id)}/kgml`;
  try {
    // KEGG has no CORS headers, so this resolves through a proxy in the chain.
    return await corsFetchText(url, looksLikeKgml);
  } catch {
    throw new Error(
      `KEGG did not return KGML for "${id}". Every public CORS proxy was unavailable — retry shortly, or upload a custom SBGN file.`
    );
  }
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
  const res = await corsFetch(url);
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
  'Plant Reactome': 'Plant Reactome (Gramene) does not expose an SBGN exporter, so its maps cannot be rendered here — browse its species/pathways for reference, and render the same organism via KEGG (e.g. ath, osa) or upload a custom SBGN file. Its curated pathways can also be exported to SBGN and loaded via "Custom SBGN File".',
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
