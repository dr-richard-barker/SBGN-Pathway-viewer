import React, { useRef, useCallback, useState, useEffect } from 'react';
import { DownloadIcon } from './icons/DownloadIcon';
import { ZoomInIcon } from './icons/ZoomInIcon';
import { ZoomOutIcon } from './icons/ZoomOutIcon';
import { ResetIcon } from './icons/ResetIcon';
import { SearchIcon } from './icons/SearchIcon';
import type { ParsedData } from '../App';

interface MainPanelProps {
  isLoading: boolean;
  error: string | null;
  pathwaySvg: string | null;
  parsedGeneData: ParsedData;
  parsedCompoundData: ParsedData;
}

interface TooltipState {
    content: string;
    x: number;
    y: number;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center text-center">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-cyan-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-lg text-gray-400">Generating visualization...</p>
        <p className="text-sm text-gray-500">This may take a moment.</p>
    </div>
);

const Placeholder: React.FC = () => (
  <div className="text-center text-gray-500">
    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <h3 className="mt-2 text-xl font-medium text-gray-400">Pathway Visualization</h3>
    <p className="mt-1 text-sm">Upload data and configure your options in the sidebar to generate a pathway map.</p>
  </div>
);

const SVG_VIEWER_CONTROLS_CLASS = "bg-gray-700 text-white hover:bg-cyan-600 font-bold p-2 rounded-lg shadow-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed";
const HIGHLIGHT_CLASS = 'highlighted-glyph';

export const MainPanel: React.FC<MainPanelProps> = ({ isLoading, error, pathwaySvg, parsedGeneData, parsedCompoundData }) => {
    const svgContainerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);

    const resetTransform = useCallback(() => {
        setTransform({ scale: 1, x: 0, y: 0 });
    }, []);

    useEffect(() => {
        resetTransform();
        setSearchTerm('');
    }, [pathwaySvg, resetTransform]);

    // Effect to handle highlighting based on search term
    useEffect(() => {
        if (!pathwaySvg || !svgContainerRef.current) return;
        
        // Clear previous highlights
        const highlightedElements = svgContainerRef.current.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
        highlightedElements.forEach(el => el.classList.remove(HIGHLIGHT_CLASS));

        if (searchTerm.trim()) {
            // Find and highlight new elements
            const geneId = `glyph-gene-${searchTerm.trim()}`;
            const compoundId = `glyph-compound-${searchTerm.trim()}`;
            const geneEl = svgContainerRef.current.querySelector(`#${geneId}`);
            const compoundEl = svgContainerRef.current.querySelector(`#${compoundId}`);

            if (geneEl) geneEl.classList.add(HIGHLIGHT_CLASS);
            if (compoundEl) compoundEl.classList.add(HIGHLIGHT_CLASS);
        }
    }, [searchTerm, pathwaySvg]);


    const downloadSvg = useCallback(() => {
        if (!pathwaySvg) return;
        const blob = new Blob([pathwaySvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pathway_visualization.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [pathwaySvg]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.1, Math.min(10, transform.scale + scaleAmount));
        setTransform(prev => ({...prev, scale: newScale}));
    };
    
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.controls, .search-bar')) return;
        setIsPanning(true);
        setStartPoint({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning) {
            let target = e.target as HTMLElement;
            let glyphGroup = null;

            // Traverse up to find the group with a glyph ID
            while (target && target !== svgContainerRef.current) {
                if (target.id && (target.id.startsWith('glyph-gene-') || target.id.startsWith('glyph-compound-'))) {
                    glyphGroup = target;
                    break;
                }
                target = target.parentElement as HTMLElement;
            }

            if (glyphGroup) {
                const [_, type, identifier] = glyphGroup.id.split('-');
                const dataMap = type === 'gene' ? parsedGeneData : parsedCompoundData;
                const data = dataMap.get(identifier);

                if (data) {
                    const content = Object.entries(data).map(([key, value]) => `<strong>${key}:</strong> ${value}`).join('<br />');
                    setTooltip({ content: `<h3>${identifier}</h3>${content}`, x: e.clientX, y: e.clientY });
                } else {
                     setTooltip({ content: `<h3>${identifier}</h3><p>No data found</p>`, x: e.clientX, y: e.clientY });
                }
            } else {
                setTooltip(null);
            }
            return;
        }
        setTransform(prev => ({...prev, x: e.clientX - startPoint.x, y: e.clientY - startPoint.y }));
    };
    
    const handleMouseUpOrLeave = () => {
        setIsPanning(false);
        setTooltip(null);
    };

    const zoom = (direction: 'in' | 'out') => {
        const scaleAmount = direction === 'in' ? 1.2 : 1 / 1.2;
        const newScale = Math.max(0.1, Math.min(10, transform.scale * scaleAmount));
        setTransform(prev => ({...prev, scale: newScale }));
    };

    return (
        <main className="flex-1 p-6 bg-gray-900 flex flex-col relative">
            <style>{`.${HIGHLIGHT_CLASS} { stroke: #fde047 !important; stroke-width: 5px !important; stroke-opacity: 0.8; }`}</style>
            
            {tooltip && (
                <div 
                    className="absolute z-30 p-2 text-sm text-white bg-gray-800 border border-gray-600 rounded-md shadow-lg pointer-events-none"
                    style={{ top: tooltip.y + 15, left: tooltip.x + 15, maxWidth: '300px' }}
                    dangerouslySetInnerHTML={{ __html: tooltip.content }}
                />
            )}

            {pathwaySvg && (
                 <div className="absolute top-8 right-8 z-20 flex flex-col space-y-2 controls">
                    <div className="relative search-bar">
                        <input
                            type="text"
                            placeholder="Highlight node..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700/80 border border-gray-600 rounded-lg shadow-sm py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white sm:text-sm"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                    </div>
                    <button 
                        onClick={downloadSvg} 
                        className="bg-cyan-600 text-white hover:bg-cyan-700 font-bold py-2 px-4 rounded-lg inline-flex items-center shadow-lg transition-colors">
                        <DownloadIcon className="w-5 h-5 mr-2"/>
                        <span>Download SVG</span>
                    </button>
                    <div className="bg-gray-800/50 p-1 rounded-lg flex flex-col space-y-1">
                        <button onClick={() => zoom('in')} className={SVG_VIEWER_CONTROLS_CLASS} aria-label="Zoom in">
                            <ZoomInIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={() => zoom('out')} className={SVG_VIEWER_CONTROLS_CLASS} aria-label="Zoom out">
                            <ZoomOutIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={resetTransform} className={SVG_VIEWER_CONTROLS_CLASS} aria-label="Reset view">
                             <ResetIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
            )}
            <div className="flex-1 w-full h-full flex items-center justify-center bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
            >
                <div 
                    ref={svgContainerRef} 
                    className="w-full h-full p-4"
                    style={{ 
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                        cursor: isPanning ? 'grabbing' : 'grab',
                        transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                     }}
                >
                    {isLoading && <LoadingSpinner />}
                    {error && !isLoading && (
                        <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-md">
                            <h3 className="font-bold">Error</h3>
                            <p>{error}</p>
                        </div>
                    )}
                    {!isLoading && !error && !pathwaySvg && <Placeholder />}
                    {pathwaySvg && !isLoading && (
                        <div dangerouslySetInnerHTML={{ __html: pathwaySvg }} className="w-full h-full [&>svg]:w-full [&>svg]:h-full" />
                    )}
                </div>
            </div>
        </main>
    );
};