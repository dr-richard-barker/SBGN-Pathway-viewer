
export type DataType = 'norm_counts' | 'deseq2';
export type CompoundDataType = 'abundance' | 'fold_change';
export type PathwayDatabase = 'Reactome' | 'Plant Reactome' | 'KEGG' | 'MetaCyc' | 'SMPDB' | 'PANTHER' | 'METACROP' | 'Custom SBGN File';
// KEGG can render either as a clean vector from KGML, or as a data overlay on
// KEGG's official pathway image (pathview-style).
export type KeggRenderMode = 'image' | 'vector';

export interface VisualizationConfig {
  pathwayDatabase: PathwayDatabase;
  dataType: DataType;
  pathwayId: string;
  geneIdType: string;
  speciesId: string;
  glyphFontSize: number;
  glyphFillColor: string;
  arcLineWidth: number;
  arcLineColor: string;
  compoundDataType: CompoundDataType;
  compoundIdType: string;
  keggRenderMode: KeggRenderMode;
}

export interface Species {
    id: string;
    displayName: string;
}

export interface Pathway {
    id: string;
    displayName: string;
}
