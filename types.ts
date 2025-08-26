
export type DataType = 'norm_counts' | 'deseq2';
export type CompoundDataType = 'abundance' | 'fold_change';
export type PathwayDatabase = 'Reactome' | 'KEGG' | 'MetaCyc' | 'SMPDB' | 'PANTHER' | 'METACROP';

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
}

export interface Species {
    id: string;
    displayName: string;
}

export interface Pathway {
    id: string;
    displayName: string;
}
