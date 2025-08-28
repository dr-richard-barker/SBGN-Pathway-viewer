import React from 'react';

interface HelpModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 sticky top-0 bg-gray-800 border-b border-gray-700 z-10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-cyan-400">How to Use the Visualizer</h2>
            <button 
                onClick={onClose}
                className="text-gray-400 hover:text-white"
                aria-label="Close help modal"
            >&times;</button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-gray-300">
            <section>
                <h3 className="text-xl font-semibold text-cyan-500 mb-2">Step-by-Step Guide</h3>
                <ol className="list-decimal list-inside space-y-2">
                    <li><strong>Upload Data:</strong> Click "Upload a file" to provide your gene and optional compound data. You can also load a sample dataset to get started quickly.</li>
                    <li><strong>Select Pathway Source:</strong> Choose your desired pathway database (e.g., Reactome, KEGG, PANTHER) from the dropdown. You can also upload your own custom SBGN file for visualization.</li>
                    <li><strong>Select Species & Pathway:</strong> Based on your database choice, select the relevant species and then the specific biological pathway. For supported databases (Reactome, KEGG), pathways containing genes from your data will be highlighted for easy identification.</li>
                    <li><strong>Configure Data Type:</strong> Specify whether your data represents 'Normalized Counts' or 'Log2 Fold Change' to ensure correct color mapping on the pathway glyphs.</li>
                    <li><strong>Customize Appearance:</strong> Adjust sliders and color pickers to fine-tune the visual style of your pathway map.</li>
                    <li><strong>Generate:</strong> Click the "Generate Pathway Map" button and let the AI create your visualization.</li>
                    <li><strong>Explore & Download:</strong> Pan, zoom, and hover over nodes to see details. Click "Download SVG" to save your work.</li>
                </ol>
            </section>
            
            <section>
                <h3 className="text-xl font-semibold text-cyan-500 mb-2">Recommended File Formats</h3>
                <p className="mb-4">The tool accepts CSV (comma-separated) or TSV (tab-separated) files. The first column must contain the primary identifiers (e.g., SYMBOL, Ensembl ID, KEGG ID).</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/70 p-4 rounded-md">
                        <h4 className="font-semibold text-gray-200">Log2 Fold Change Data</h4>
                        <p className="text-sm text-gray-400 mb-2">Should include columns for log2 fold change and, ideally, an adjusted p-value for sorting significance.</p>
                        <pre className="text-xs bg-gray-800 p-2 rounded whitespace-pre-wrap"><code>
{`SYMBOL,baseMean,log2FoldChange,padj
GENE1,150.5,2.75,0.0001
GENE2,89.2,-1.98,0.0023
GENE3,205.1,1.50,0.0410`}
                        </code></pre>
                    </div>
                     <div className="bg-gray-900/70 p-4 rounded-md">
                        <h4 className="font-semibold text-gray-200">Normalized Counts / Abundance</h4>
                        <p className="text-sm text-gray-400 mb-2">The first column is the identifier, and subsequent columns are expression/abundance values.</p>
                        <pre className="text-xs bg-gray-800 p-2 rounded whitespace-pre-wrap"><code>
{`SYMBOL,Sample1,Sample2,Sample3
GENE1,512,480,550
GENE2,10,25,15
GENE3,1024,1100,995`}
                        </code></pre>
                    </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
};
