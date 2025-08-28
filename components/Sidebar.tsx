
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { type VisualizationConfig, type DataType, type Species, type Pathway, type CompoundDataType, type PathwayDatabase } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { fetchSpecies, fetchPathways, mapGenesToPathways, mapGenesToPathwaysKegg } from '../services/pathwayService';
import { parseGeneIds } from '../services/dataProcessor';

interface SidebarProps {
  config: VisualizationConfig;
  setConfig: React.Dispatch<React.SetStateAction<VisualizationConfig>>;
  geneData: string | null;
  setGeneData: (data: string | null) => void;
  compoundData: string | null;
  setCompoundData: (data: string | null) => void;
  onGenerate: () => void;
  isLoading: boolean;
  customSbgnFile: string | null;
  setCustomSbgnFile: (data: string | null) => void;
}

const ALL_DATABASES: PathwayDatabase[] = ['Reactome', 'KEGG', 'MetaCyc', 'SMPDB', 'PANTHER', 'METACROP', 'Custom SBGN File'];

export const Sidebar: React.FC<SidebarProps> = ({ config, setConfig, geneData, setGeneData, compoundData, setCompoundData, onGenerate, isLoading, customSbgnFile, setCustomSbgnFile }) => {
  const [geneFileName, setGeneFileName] = useState<string>('');
  const [compoundFileName, setCompoundFileName] = useState<string>('');
  const [customSbgnFileName, setCustomSbgnFileName] = useState<string>('');
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [speciesSearch, setSpeciesSearch] = useState<string>('');
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [pathwaySearch, setPathwaySearch] = useState<string>('');
  const [highlightedPathways, setHighlightedPathways] = useState<Set<string>>(new Set());
  
  const [speciesLoading, setSpeciesLoading] = useState<boolean>(false);
  const [pathwaysLoading, setPathwaysLoading] = useState<boolean>(false);
  
  const [speciesError, setSpeciesError] = useState<string | null>(null);
  const [pathwayError, setPathwayError] = useState<string | null>(null);

  // Fetch species when database changes
  useEffect(() => {
    const loadSpecies = async () => {
      if (config.pathwayDatabase === 'Custom SBGN File') {
        setSpeciesList([]);
        setPathways([]);
        return;
      }
      setSpeciesLoading(true);
      setSpeciesError(null);
      setSpeciesList([]);
      setPathways([]); // Clear pathways
      setConfig(prev => ({ ...prev, speciesId: '', pathwayId: '' }));
      try {
        const species = await fetchSpecies(config.pathwayDatabase);
        setSpeciesList(species);
        if (species.length > 0) {
           setConfig(prev => ({ ...prev, speciesId: species[0].id }));
        }
      } catch (error) {
        console.error("Failed to fetch species:", error);
        setSpeciesError(error instanceof Error ? error.message : 'Failed to load species.');
      } finally {
        setSpeciesLoading(false);
      }
    };
    loadSpecies();
  }, [config.pathwayDatabase, setConfig]);

  // Fetch pathways when species changes
  useEffect(() => {
    if (!config.speciesId || config.pathwayDatabase === 'Custom SBGN File') return;
    const loadPathways = async () => {
      setPathwaysLoading(true);
      setPathwayError(null);
      setPathways([]);
      setConfig(prev => ({ ...prev, pathwayId: '' }));
      try {
        const fetchedPathways = await fetchPathways(config.pathwayDatabase, config.speciesId);
        setPathways(fetchedPathways);
      } catch (error) {
        console.error("Failed to fetch pathways:", error);
        setPathwayError(error instanceof Error ? error.message : 'Failed to load pathways.');
      } finally {
        setPathwaysLoading(false);
      }
    };
    loadPathways();
  }, [config.speciesId, config.pathwayDatabase, setConfig]);

  // Highlight pathways containing user genes (Reactome and KEGG)
  useEffect(() => {
      const findHighlights = async () => {
          if (!geneData || pathways.length === 0 || !config.speciesId || config.pathwayDatabase === 'Custom SBGN File') {
              setHighlightedPathways(new Set());
              return;
          }

          const geneIds = parseGeneIds(geneData);
          if (geneIds.length === 0) {
              setHighlightedPathways(new Set());
              return;
          }
          
          let mappedPathwayIds: Set<string> = new Set();
          if (config.pathwayDatabase === 'Reactome') {
              mappedPathwayIds = await mapGenesToPathways(config.speciesId, geneIds);
          } else if (config.pathwayDatabase === 'KEGG') {
              mappedPathwayIds = await mapGenesToPathwaysKegg(config.speciesId, geneIds);
          }
          
          setHighlightedPathways(mappedPathwayIds);
      };

      const timer = setTimeout(findHighlights, 300); // Debounce to avoid excessive API calls
      return () => clearTimeout(timer);
  }, [geneData, pathways, config.speciesId, config.pathwayDatabase]);


  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'gene' | 'compound') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (type === 'gene') {
            setGeneFileName(file.name);
            setGeneData(text);
        } else {
            setCompoundFileName(file.name);
            setCompoundData(text);
        }
      };
      reader.readAsText(file);
    } else {
       if (type === 'gene') {
            setGeneFileName('');
            setGeneData(null);
       } else {
            setCompoundFileName('');
            setCompoundData(null);
       }
    }
  }, [setGeneData, setCompoundData]);
  
  const handleSbgnFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCustomSbgnFile(text);
        setCustomSbgnFileName(file.name);
      };
      reader.readAsText(file);
    } else {
       setCustomSbgnFileName('');
       setCustomSbgnFile(null);
    }
  }, [setCustomSbgnFile]);


  const handleConfigChange = useCallback(<K extends keyof VisualizationConfig>(key: K, value: VisualizationConfig[K]) => {
      setConfig(prev => ({ ...prev, [key]: value }));
  }, [setConfig]);

  const handleLoadSampleGeneData = useCallback(() => {
    const sampleData = `SYMBOL,log2FoldChange,padj
CDC20,2.5,0.001
AURKB,-1.8,0.005
PLK1,3.1,0.0001
CCNB1,2.8,0.0005
BUB1B,-2.2,0.002
MAD2L1,1.5,0.01
CDK1,1.9,0.008
FOXM1,-1.2,0.03`;
    setGeneData(sampleData);
    setGeneFileName('sample_gene_data.csv');
    // Sample data is for human on Reactome
    setConfig(prev => ({ ...prev, pathwayDatabase: 'Reactome', dataType: 'deseq2', speciesId: '48887', pathwayId: 'R-HSA-1640170' }));
  }, [setGeneData, setConfig]);

  const handleLoadSampleCompoundData = useCallback(() => {
    const sampleData = `KEGG,log2FoldChange
C00022,1.5
C00074,-1.2
C00148,2.1`;
    setCompoundData(sampleData);
    setCompoundFileName('sample_compound_data.csv');
    setConfig(prev => ({...prev, compoundDataType: 'fold_change', compoundIdType: 'kegg' }));
  }, [setCompoundData, setConfig]);

  const filteredSpecies = useMemo(() => {
    return speciesList.filter(s => 
        s.displayName.toLowerCase().includes(speciesSearch.toLowerCase())
    );
  }, [speciesList, speciesSearch]);

  const filteredPathways = useMemo(() => {
    const lowercasedFilter = pathwaySearch.toLowerCase();
    return pathways.filter(p => p.displayName.toLowerCase().includes(lowercasedFilter));
  }, [pathways, pathwaySearch]);

  const groupedPathways = useMemo(() => {
    if (filteredPathways.length === 0) return { highlighted: [], other: [] };

    const highlighted = filteredPathways.filter(p => highlightedPathways.has(p.id));
    const other = filteredPathways.filter(p => !highlightedPathways.has(p.id));
    
    return { highlighted, other };
  }, [filteredPathways, highlightedPathways]);

  const commonIdTypes = ['SYMBOL', 'Ensembl', 'Entrez', 'UniProt'];
  const commonCpdIdTypes = ['kegg', 'chebi', 'name'];

  return (
    <aside className="w-full md:w-96 bg-gray-800 p-6 space-y-6 overflow-y-auto border-r border-gray-700">
      
      {/* Step 1: Gene Data */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-cyan-400">1. Upload Gene Data</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
            <div className="flex text-sm text-gray-400">
              <label htmlFor="gene-file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-cyan-500 hover:text-cyan-400 focus-within:outline-none">
                <span>Upload a file</span>
                <input id="gene-file-upload" type="file" className="sr-only" accept=".csv,.tsv,.txt" onChange={(e) => handleFileChange(e, 'gene')} />
              </label>
            </div>
            <p className="text-xs text-gray-500">{geneFileName || 'CSV, TSV, TXT'}</p>
          </div>
        </div>
        <div className="text-center">
          <button onClick={handleLoadSampleGeneData} className="text-sm font-medium text-cyan-500 hover:text-cyan-400 underline">
            Or use sample gene data
          </button>
        </div>
      </div>
      
      {/* Step 2: Compound Data */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-cyan-400">2. Upload Compound Data (Optional)</label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
          <div className="space-y-1 text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
            <div className="flex text-sm text-gray-400">
              <label htmlFor="compound-file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-cyan-500 hover:text-cyan-400 focus-within:outline-none">
                <span>Upload a file</span>
                <input id="compound-file-upload" type="file" className="sr-only" accept=".csv,.tsv,.txt" onChange={(e) => handleFileChange(e, 'compound')} />
              </label>
            </div>
            <p className="text-xs text-gray-500">{compoundFileName || 'CSV, TSV, TXT'}</p>
          </div>
        </div>
        <div className="text-center">
          <button onClick={handleLoadSampleCompoundData} className="text-sm font-medium text-cyan-500 hover:text-cyan-400 underline">
            Or use sample compound data
          </button>
        </div>
      </div>

      {/* Step 3: Configure */}
      <div className="space-y-2">
          <label className="block text-sm font-medium text-cyan-400">3. Configure Pathway</label>
          <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
            <div>
              <label htmlFor="pathwayDatabase" className="block text-sm font-medium text-gray-300">Pathway Database</label>
              <select 
                id="pathwayDatabase" 
                value={config.pathwayDatabase} 
                onChange={(e) => handleConfigChange('pathwayDatabase', e.target.value as PathwayDatabase)} 
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md"
              >
                {ALL_DATABASES.map(db => <option key={db} value={db}>{db}</option>)}
              </select>
            </div>

            {config.pathwayDatabase === 'Custom SBGN File' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300">Upload Custom SBGN File</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                      <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                      <div className="flex text-sm text-gray-400">
                        <label htmlFor="sbgn-file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-cyan-500 hover:text-cyan-400 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input id="sbgn-file-upload" type="file" className="sr-only" accept=".sbgn,.xml" onChange={handleSbgnFileChange} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">{customSbgnFileName || 'SBGN, XML'}</p>
                    </div>
                  </div>
                </div>
            ) : (
              <>
                <div>
                  <label htmlFor="species-search" className="block text-sm font-medium text-gray-300">Species</label>
                  <input
                    type="text"
                    id="species-search"
                    placeholder="Search for a species..."
                    value={speciesSearch}
                    onChange={(e) => setSpeciesSearch(e.target.value)}
                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                    aria-label="Search for a species"
                    disabled={speciesLoading}
                  />
                  <select 
                    id="species" 
                    value={config.speciesId} 
                    onChange={(e) => handleConfigChange('speciesId', e.target.value)} 
                    className="mt-2 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={speciesLoading || speciesList.length === 0}
                  >
                    <option value="" disabled>
                        {speciesLoading ? 'Loading species...' : 
                        speciesError ? 'Error loading species' : 
                        speciesList.length === 0 ? 'No species available' : 'Select a species'}
                    </option>
                    {filteredSpecies.map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}
                  </select>
                  {speciesError && <p className="mt-1 text-xs text-red-400">{speciesError}</p>}
                </div>
                <div>
                    <label htmlFor="pathway-search" className="block text-sm font-medium text-gray-300">Pathway</label>
                    <input
                        type="text"
                        id="pathway-search"
                        placeholder="Search for a pathway..."
                        value={pathwaySearch}
                        onChange={(e) => setPathwaySearch(e.target.value)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                        aria-label="Search for a pathway"
                        disabled={pathwaysLoading || pathways.length === 0}
                    />
                    <select 
                        id="pathwayId" 
                        value={config.pathwayId} 
                        onChange={(e) => handleConfigChange('pathwayId', e.target.value)} 
                        disabled={pathwaysLoading || pathways.length === 0} 
                        className="mt-2 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        <option value="" disabled>
                            {pathwaysLoading ? 'Loading pathways...' : 
                            pathwayError ? 'Error loading pathways' : 
                            pathways.length === 0 ? 'No pathways available' : 'Select a pathway'}
                        </option>
                        {groupedPathways.highlighted.length > 0 && (
                            <optgroup label="Pathways with your genes">
                                {groupedPathways.highlighted.map(p => (
                                    <option key={p.id} value={p.id}>{p.displayName}</option>
                                ))}
                            </optgroup>
                        )}
                        {groupedPathways.other.length > 0 && (
                            <optgroup label={groupedPathways.highlighted.length > 0 ? "Other pathways" : "All Pathways"}>
                                {groupedPathways.other.map(p => (
                                    <option key={p.id} value={p.id}>{p.displayName}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                    {pathwayError && <p className="mt-1 text-xs text-red-400">{pathwayError}</p>}
                </div>
              </>
            )}

            <div>
              <label htmlFor="dataType" className="block text-sm font-medium text-gray-300">Gene Data Type</label>
              <select id="dataType" value={config.dataType} onChange={(e) => handleConfigChange('dataType', e.target.value as DataType)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md">
                <option value="norm_counts">Normalized Counts</option>
                <option value="deseq2">Log2 Fold Change</option>
              </select>
            </div>
             <div>
                <label htmlFor="geneIdType" className="block text-sm font-medium text-gray-300">Gene ID Type</label>
                 <select id="geneIdType" value={config.geneIdType} onChange={(e) => handleConfigChange('geneIdType', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md">
                    {commonIdTypes.map(type => <option key={type} value={type}>{type}</option>)}
                 </select>
            </div>
            {compoundData && (
                <>
                    <div>
                        <label htmlFor="compoundDataType" className="block text-sm font-medium text-gray-300">Compound Data Type</label>
                        <select id="compoundDataType" value={config.compoundDataType} onChange={(e) => handleConfigChange('compoundDataType', e.target.value as CompoundDataType)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md">
                            <option value="abundance">Abundance</option>
                            <option value="fold_change">Log2 Fold Change</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="compoundIdType" className="block text-sm font-medium text-gray-300">Compound ID Type</label>
                        <select id="compoundIdType" value={config.compoundIdType} onChange={(e) => handleConfigChange('compoundIdType', e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm rounded-md">
                            {commonCpdIdTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                </>
            )}
          </div>
      </div>
      
       <div className="space-y-2">
          <label className="block text-sm font-medium text-cyan-400">4. Customize Appearance</label>
          <div className="bg-gray-900/50 p-4 rounded-lg space-y-4">
              <div>
                <label htmlFor="glyphFontSize" className="block text-sm font-medium text-gray-300">Glyph Font Size: {config.glyphFontSize}px</label>
                <input type="range" id="glyphFontSize" min="1" max="30" value={config.glyphFontSize} onChange={(e) => handleConfigChange('glyphFontSize', Number(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="glyphFillColor" className="block text-sm font-medium text-gray-300">Default Glyph Color</label>
                <input type="color" id="glyphFillColor" value={config.glyphFillColor} onChange={(e) => handleConfigChange('glyphFillColor', e.target.value)} className="w-10 h-8 p-1 bg-gray-700 border border-gray-600 cursor-pointer rounded-md" />
              </div>
               <div>
                <label htmlFor="arcLineWidth" className="block text-sm font-medium text-gray-300">Arc Line Width: {config.arcLineWidth}px</label>
                <input type="range" id="arcLineWidth" min="0.1" max="5" step="0.1" value={config.arcLineWidth} onChange={(e) => handleConfigChange('arcLineWidth', Number(e.target.value))} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
               <div className="flex items-center justify-between">
                <label htmlFor="arcLineColor" className="block text-sm font-medium text-gray-300">Arc Line Color</label>
                <input type="color" id="arcLineColor" value={config.arcLineColor} onChange={(e) => handleConfigChange('arcLineColor', e.target.value)} className="w-10 h-8 p-1 bg-gray-700 border border-gray-600 cursor-pointer rounded-md" />
              </div>
          </div>
      </div>

      <div>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Generating...' : 'Generate Pathway Map'}
        </button>
      </div>
    </aside>
  );
};
