
import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { type VisualizationConfig } from './types';
import { generatePathwaySvg } from './services/geminiService';
import { summarizeGeneData, parseDataToMap } from './services/dataProcessor';
import { HelpModal } from './components/HelpModal';
import { HelpIcon } from './components/icons/HelpIcon';

export type ParsedData = Map<string, Record<string, string>>;

const App: React.FC = () => {
  const [config, setConfig] = useState<VisualizationConfig>({
    pathwayDatabase: 'Reactome',
    dataType: 'norm_counts',
    pathwayId: 'R-HSA-70171', // Default: Mitotic G1 phase and G1/S transition
    geneIdType: 'SYMBOL',
    speciesId: '48887', // Default: Homo sapiens for Reactome
    glyphFontSize: 10,
    glyphFillColor: '#38bdf8',
    arcLineWidth: 1,
    arcLineColor: '#94a3b8',
    compoundDataType: 'abundance',
    compoundIdType: 'kegg'
  });
  const [geneData, setGeneData] = useState<string | null>(null);
  const [compoundData, setCompoundData] = useState<string | null>(null);
  const [parsedGeneData, setParsedGeneData] = useState<ParsedData>(new Map());
  const [parsedCompoundData, setParsedCompoundData] = useState<ParsedData>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pathwaySvg, setPathwaySvg] = useState<string | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState<boolean>(false);

  const handleGenerate = useCallback(async () => {
    if (!geneData) {
      setError('Please upload gene expression data before generating.');
      return;
    }
     if (!config.pathwayId) {
      setError('Please select a pathway before generating.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPathwaySvg(null);

    try {
      const summarizedGeneData = summarizeGeneData(geneData, config.dataType);
      const summarizedCompoundData = compoundData ? summarizeGeneData(compoundData, config.compoundDataType === 'abundance' ? 'norm_counts' : 'deseq2') : null;
      
      setParsedGeneData(parseDataToMap(geneData));
      if (compoundData) {
        setParsedCompoundData(parseDataToMap(compoundData));
      } else {
        setParsedCompoundData(new Map());
      }

      const svg = await generatePathwaySvg(summarizedGeneData, summarizedCompoundData, config);
      setPathwaySvg(svg);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [geneData, compoundData, config]);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
        <div className="w-8"></div> {/* Spacer */}
        <h1 className="text-2xl font-bold text-cyan-400 text-center tracking-wider">
          AI-Powered SBGN Pathway Visualizer
        </h1>
        <button
          onClick={() => setIsHelpVisible(true)}
          className="text-gray-400 hover:text-cyan-400 transition-colors"
          aria-label="Show help guide"
        >
          <HelpIcon className="w-7 h-7" />
        </button>
      </header>
      <div className="flex-grow flex flex-col md:flex-row">
        <Sidebar
          config={config}
          setConfig={setConfig}
          geneData={geneData}
          setGeneData={setGeneData}
          compoundData={compoundData}
          setCompoundData={setCompoundData}
          onGenerate={handleGenerate}
          isLoading={isLoading}
        />
        <MainPanel
          isLoading={isLoading}
          error={error}
          pathwaySvg={pathwaySvg}
          parsedGeneData={parsedGeneData}
          parsedCompoundData={parsedCompoundData}
        />
      </div>
      <HelpModal isVisible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default App;
