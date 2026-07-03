import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchCuratedCatalog, loadCuratedDataset, type CuratedDataset,
  fetchOsdrStudy, fetchContrastNames, liveImportContrast,
  type OsdrStudy, OSDR_ID_COLUMNS, LIVE_IMPORT_MAX_BYTES,
} from '../services/osdr';

export interface OsdrImportPayload {
  csv: string;
  keggOrg?: string;
  geneIdType?: string;
  pathwayId?: string;
  autoRun?: boolean;
  label: string;
}

interface Props {
  onImport: (p: OsdrImportPayload) => void;
  isBusy: boolean;
}

const SELECT = 'mt-1 block w-full pl-3 pr-8 py-2 text-sm bg-gray-700 border-gray-600 rounded-md focus:outline-none focus:ring-cyan-500 focus:border-cyan-500';
const BTN = 'w-full py-2 px-3 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

export const OsdrPanel: React.FC<Props> = ({ onImport, isBusy }) => {
  const [mode, setMode] = useState<'curated' | 'live'>('curated');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Curated
  const [catalog, setCatalog] = useState<CuratedDataset[]>([]);
  const [curatedIdx, setCuratedIdx] = useState(0);

  // Live
  const [osdInput, setOsdInput] = useState('OSD-120');
  const [study, setStudy] = useState<OsdrStudy | null>(null);
  const [contrasts, setContrasts] = useState<string[]>([]);
  const [contrast, setContrast] = useState('');
  const [idColumn, setIdColumn] = useState('TAIR');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchCuratedCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setError(null); setBusy(true);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  }, []);

  const importCurated = () => run(async () => {
    const ds = catalog[curatedIdx];
    if (!ds) throw new Error('No dataset selected.');
    const csv = await loadCuratedDataset(ds);
    onImport({
      csv, keggOrg: ds.keggOrg, geneIdType: ds.geneIdType,
      pathwayId: ds.suggestedPathwayId, autoRun: !!ds.suggestedPathwayId,
      label: `${ds.osd}: ${ds.title}`,
    });
  });

  const fetchStudy = () => run(async () => {
    setStudy(null); setContrasts([]); setContrast('');
    const s = await fetchOsdrStudy(osdInput);
    setStudy(s);
    const names = await fetchContrastNames(s);
    setContrasts(names);
    if (names.length) setContrast(names[0]);
  });

  const importLive = () => run(async () => {
    if (!study || !contrast) throw new Error('Fetch a study and pick a contrast first.');
    setProgress(0);
    const { csv, genes } = await liveImportContrast(study, contrast, idColumn, (b) => setProgress(b));
    const org = /arabidopsis/i.test(study.osdId) ? 'ath' : undefined;
    onImport({ csv, keggOrg: org, geneIdType: idColumn, autoRun: false, label: `${study.osdId} · ${genes} genes` });
  });

  const tooLarge = study?.deFile && study.deSizeBytes > LIVE_IMPORT_MAX_BYTES;
  const working = busy || isBusy;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-cyan-400">Import from NASA OSDR</label>
      <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
        <div role="radiogroup" aria-label="OSDR import mode" className="grid grid-cols-2 gap-2">
          {(['curated', 'live'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setError(null); }}
              className={`py-1.5 px-2 text-xs rounded-md border transition-colors ${mode === m ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'}`}>
              {m === 'curated' ? 'Curated collection' : 'Live OSD accession'}
            </button>
          ))}
        </div>

        {mode === 'curated' ? (
          <>
            <label htmlFor="osdr-curated" className="sr-only">Curated dataset</label>
            <select id="osdr-curated" className={SELECT} value={curatedIdx}
              onChange={(e) => setCuratedIdx(Number(e.target.value))} disabled={catalog.length === 0}>
              {catalog.length === 0 && <option>Loading catalog…</option>}
              {catalog.map((d, i) => <option key={d.osd + d.file} value={i}>{d.osd} — {d.title}</option>)}
            </select>
            {catalog[curatedIdx] && (
              <p className="text-xs text-gray-500">
                {catalog[curatedIdx].organism} · {catalog[curatedIdx].genes?.toLocaleString()} genes ·
                suggested: {catalog[curatedIdx].suggestedPathwayName}
              </p>
            )}
            <button onClick={importCurated} disabled={working || catalog.length === 0} className={`${BTN} bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500`}>
              {working ? 'Importing…' : 'Import & project'}
            </button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <input aria-label="OSD accession" value={osdInput} onChange={(e) => setOsdInput(e.target.value)}
                placeholder="OSD-120" className="flex-1 bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500" />
              <button onClick={fetchStudy} disabled={working} className={`${BTN} w-auto px-3 bg-gray-700 border border-gray-600 hover:bg-gray-600 text-gray-200 focus:ring-cyan-500`}>
                Fetch
              </button>
            </div>
            {study && (
              <>
                <p className="text-xs text-gray-400">{study.osdId} · DE table {study.deSizeBytes ? `${(study.deSizeBytes / 1e6).toFixed(1)} MB` : 'n/a'}</p>
                <label htmlFor="osdr-contrast" className="sr-only">Contrast</label>
                <select id="osdr-contrast" className={SELECT} value={contrast} onChange={(e) => setContrast(e.target.value)} disabled={!contrasts.length}>
                  {!contrasts.length && <option>No contrasts found</option>}
                  {contrasts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <label htmlFor="osdr-idcol" className="sr-only">Gene ID column</label>
                <select id="osdr-idcol" className={SELECT} value={idColumn} onChange={(e) => setIdColumn(e.target.value)}>
                  {OSDR_ID_COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {tooLarge && <p className="text-xs text-amber-400">This DE table is large; browser import may fail. Prefer the curated collection or the offline pipeline.</p>}
                {busy && progress > 0 && <p className="text-xs text-gray-500">Downloaded {(progress / 1e6).toFixed(1)} MB…</p>}
                <button onClick={importLive} disabled={working || !contrast} className={`${BTN} bg-cyan-600 hover:bg-cyan-700 text-white focus:ring-cyan-500`}>
                  {working ? 'Importing…' : 'Import contrast'}
                </button>
              </>
            )}
          </>
        )}

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        <p className="text-[11px] text-gray-500">
          Data: NASA <a className="text-cyan-500 hover:text-cyan-400 underline" href="https://osdr.nasa.gov" target="_blank" rel="noopener noreferrer">OSDR / GeneLab</a>.
          After importing, choose a KEGG pathway and Generate.
        </p>
      </div>
    </div>
  );
};
