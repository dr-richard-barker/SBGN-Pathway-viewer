
export type DataType = 'norm_counts' | 'deseq2';
export type CompoundDataType = 'abundance' | 'fold_change';

export interface VisualizationConfig {
  dataType: DataType;
  pathwayId: string;
  geneIdType: string;
  speciesDbId: number;
  glyphFontSize: number;
  glyphFillColor: string;
  arcLineWidth: number;
  arcLineColor: string;
  compoundDataType: CompoundDataType;
  compoundIdType: string;
}

export interface Species {
    dbId: number;
    displayName: string;
    name: string[];
}

export interface Pathway {
    stId: string;
    displayName: string;
}