
import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MainPanel } from './components/MainPanel';
import { type VisualizationConfig } from './types';
import { generatePathwayMap } from './services/pathwayRenderer';
import { SAMPLE_GENE_CSV, SAMPLE_COMPOUND_CSV } from './services/sampleData';
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
    compoundIdType: 'kegg',
    keggRenderMode: 'image'
  });
  const [geneData, setGeneData] = useState<string | null>(null);
  const [compoundData, setCompoundData] = useState<string | null>(null);
  const [customSbgnFile, setCustomSbgnFile] = useState<string | null>(null);
  const [parsedGeneData, setParsedGeneData] = useState<ParsedData>(new Map());
  const [parsedCompoundData, setParsedCompoundData] = useState<ParsedData>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pathwaySvg, setPathwaySvg] = useState<string | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState<boolean>(false);

  const runGeneration = useCallback(
    async (opts: {
      useDemo?: boolean;
      geneOverride?: string;
      compoundOverride?: string;
      configOverride?: VisualizationConfig;
    } = {}) => {
      const gd = opts.geneOverride ?? geneData;
      const cd = opts.compoundOverride ?? compoundData;
      // Use an explicit config override when provided — setConfig is async, so a
      // caller that just changed config (e.g. the demo) must pass it in directly.
      const cfg = opts.configOverride ?? config;

      if (!opts.useDemo) {
        if (!gd) {
          setError('Please upload gene expression data before generating.');
          return;
        }
        if (cfg.pathwayDatabase === 'Custom SBGN File' && !customSbgnFile) {
          setError('Please upload a custom SBGN pathway file.');
          return;
        }
        if (cfg.pathwayDatabase !== 'Custom SBGN File' && !cfg.pathwayId) {
          setError('Please select a pathway before generating.');
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      setPathwaySvg(null);

      try {
        const { svg, geneMap, compoundMap } = await generatePathwayMap({
          geneData: gd ?? '',
          compoundData: cd,
          config: cfg,
          customSbgnFile,
          useDemo: opts.useDemo,
        });
        setParsedGeneData(geneMap);
        setParsedCompoundData(compoundMap);
        setPathwaySvg(svg);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    },
    [geneData, compoundData, config, customSbgnFile]
  );

  const handleGenerate = useCallback(() => runGeneration(), [runGeneration]);

  // Offline demo: loads the bundled sample data and renders the bundled SBGN map
  // with zero network access — proves the app runs fully standalone.
  const handleLoadDemo = useCallback(() => {
    const demoConfig: VisualizationConfig = {
      ...config,
      dataType: 'deseq2',
      compoundDataType: 'fold_change',
      compoundIdType: 'kegg',
    };
    setGeneData(SAMPLE_GENE_CSV);
    setCompoundData(SAMPLE_COMPOUND_CSV);
    setConfig(demoConfig);
    runGeneration({
      useDemo: true,
      geneOverride: SAMPLE_GENE_CSV,
      compoundOverride: SAMPLE_COMPOUND_CSV,
      configOverride: demoConfig,
    });
  }, [config, runGeneration]);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-cyan-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
      >
        Skip to pathway map
      </a>
      <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center">
        <div className="w-8"></div> {/* Spacer */}
        <h1 className="text-2xl font-bold text-cyan-400 text-center tracking-wider">
          SBGN Pathway Visualizer
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
          onLoadDemo={handleLoadDemo}
          isLoading={isLoading}
          customSbgnFile={customSbgnFile}
          setCustomSbgnFile={setCustomSbgnFile}
        />
        <MainPanel
          isLoading={isLoading}
          error={error}
          pathwaySvg={pathwaySvg}
          parsedGeneData={parsedGeneData}
          parsedCompoundData={parsedCompoundData}
        />
      </div>
      <footer className="bg-gray-800 border-t border-gray-700 px-4 py-3 text-xs text-gray-400 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <span>SBGN Pathway Visualizer — runs entirely in your browser, no API key.</span>
        <a className="text-cyan-400 hover:text-cyan-300 underline" href="https://github.com/dr-richard-barker/SBGN-Pathway-viewer" target="_blank" rel="noopener noreferrer">Source &amp; docs</a>
        <span>MIT licensed</span>
        <span>Pathways: Reactome &amp; KEGG</span>
      </footer>
      <HelpModal isVisible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default App;
