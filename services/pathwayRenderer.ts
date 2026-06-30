/**
 * Top-level, AI-free pathway generation: fetch the pathway source (SBGN-ML or
 * KGML), parse the uploaded omics data, and render a faithful SVG with the data
 * overlaid. Replaces the former geminiService.ts.
 */

import { type VisualizationConfig } from '../types';
import { parseDataToMap } from './dataProcessor';
import { getPathwaySource, fetchKeggImage, type KeggImage } from './sbgnSource';
import { type DataMap } from './overlay';
import { renderSbgnToSvg } from './sbgnRenderer';
import { renderKgmlToSvg } from './kgmlRenderer';

export interface PathwayResult {
  svg: string;
  geneMap: DataMap;
  compoundMap: DataMap;
}

export interface GenerateArgs {
  geneData: string;
  compoundData: string | null;
  config: VisualizationConfig;
  customSbgnFile: string | null;
  useDemo?: boolean;
}

export async function generatePathwayMap(args: GenerateArgs): Promise<PathwayResult> {
  const { geneData, compoundData, config, customSbgnFile, useDemo } = args;

  const geneMap: DataMap = parseDataToMap(geneData);
  const compoundMap: DataMap = compoundData ? parseDataToMap(compoundData) : new Map();

  const source = await getPathwaySource({ config, customSbgnFile, useDemo });
  const renderOpts = { geneData: geneMap, compoundData: compoundMap, config };

  if (source.format === 'kgml') {
    let backgroundImage: KeggImage | undefined;
    // Image-overlay mode: fetch KEGG's PNG; fall back to vector if unavailable.
    if (!useDemo && config.pathwayDatabase === 'KEGG' && config.keggRenderMode === 'image') {
      try {
        backgroundImage = await fetchKeggImage(config.pathwayId);
      } catch (e) {
        console.warn('KEGG image overlay unavailable, falling back to vector KGML rendering.', e);
      }
    }
    return { svg: renderKgmlToSvg(source.content, { ...renderOpts, backgroundImage }), geneMap, compoundMap };
  }

  return { svg: renderSbgnToSvg(source.content, renderOpts), geneMap, compoundMap };
}
