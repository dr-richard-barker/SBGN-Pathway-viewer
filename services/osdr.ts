/**
 * NASA OSDR (Open Science Data Repository / GeneLab) import.
 *
 * Two paths, because OSDR only sends `Access-Control-Allow-Origin: osdr.nasa.gov`
 * (so the browser must use the CORS-proxy chain), and processed differential-
 * expression tables can be very large (OSD-120 is 252 MB, 132 contrasts):
 *
 *  1. Curated catalog  — small, pre-sliced gene tables shipped with the app
 *     (public/osdr/manifest.json). Instant and reliable; also the FAIR collection.
 *  2. Live API import  — fetch a study's file list + contrasts, then slim the DE
 *     table for one chosen contrast in the browser. Size-guarded: very large
 *     tables are refused with guidance to use the curated / pipeline route.
 */

import { corsFetch, corsFetchText } from './proxy';

const OSDR = 'https://osdr.nasa.gov';
const FILES_API = (num: string) => `${OSDR}/osdr/data/osd/files/${num}/`;

// App base path (e.g. "/SBGN-Pathway-viewer/app/"). Vite injects import.meta.env.BASE_URL.
const BASE_URL: string = ((import.meta as any)?.env?.BASE_URL as string) || './';

/** Accept "OSD-120", "osd 120", "120", "GLDS-120" → "120". */
export const normalizeOsdNumber = (input: string): string => {
  const m = input.trim().match(/(\d+)/);
  return m ? m[1] : '';
};

// ---- Curated catalog -----------------------------------------------------

export interface CuratedDataset {
  osd: string;
  title: string;
  organism: string;
  keggOrg: string;
  geneIdType: string;
  contrast: string;
  file: string;
  genes?: number;
  suggestedPathwayId?: string;
  suggestedPathwayName?: string;
  source?: string;
}

/** Loads the bundled catalog. Served from the app's own origin (no proxy). */
export async function fetchCuratedCatalog(): Promise<CuratedDataset[]> {
  const res = await fetch(`${BASE_URL}osdr/manifest.json`);
  if (!res.ok) throw new Error('Could not load the OSDR catalog.');
  const data = await res.json();
  return Array.isArray(data.datasets) ? data.datasets : [];
}

/** Fetches a curated slim gene table (already in gene_id,log2FoldChange,padj form). */
export async function loadCuratedDataset(ds: CuratedDataset): Promise<string> {
  const res = await fetch(`${BASE_URL}osdr/${ds.file}`);
  if (!res.ok) throw new Error(`Could not load ${ds.file}.`);
  return res.text();
}

// ---- Live OSDR API -------------------------------------------------------

export interface OsdrFile { file_name: string; category: string; subcategory: string; remote_url: string; file_size?: number; }
export interface OsdrStudy {
  number: string;
  osdId: string;
  deFile: OsdrFile | null;
  contrastsFile: OsdrFile | null;
  deSizeBytes: number;
}

const downloadUrl = (f: OsdrFile): string => (f.remote_url.startsWith('http') ? f.remote_url : `${OSDR}${f.remote_url}`);

/** Fetch a study's processed-RNA-seq DE + contrasts file references. */
export async function fetchOsdrStudy(input: string): Promise<OsdrStudy> {
  const number = normalizeOsdNumber(input);
  if (!number) throw new Error('Enter an OSD accession, e.g. "OSD-120".');
  const json = await corsFetchText(FILES_API(number), (t) => t.includes('study_files') || t.includes('"studies"'));
  const data = JSON.parse(json);
  const studyKey = Object.keys(data.studies || {})[0];
  const files: OsdrFile[] = data?.studies?.[studyKey]?.study_files ?? [];
  if (files.length === 0) throw new Error(`No files found for OSD-${number}. Is it a valid, public study?`);

  const isDe = (f: OsdrFile) =>
    /differential_expression/i.test(f.file_name) && /\.csv$/i.test(f.file_name) && !/contrasts|sampletable/i.test(f.file_name);
  const deFile = files.find(isDe) ?? null;
  const contrastsFile = files.find((f) => /contrasts.*\.csv$/i.test(f.file_name)) ?? null;
  return {
    number,
    osdId: studyKey || `OSD-${number}`,
    deFile,
    contrastsFile,
    deSizeBytes: deFile?.file_size ?? 0,
  };
}

/** Parse the small contrasts.csv to list available contrast names. */
export async function fetchContrastNames(study: OsdrStudy): Promise<string[]> {
  if (!study.contrastsFile) return [];
  const text = await corsFetchText(downloadUrl(study.contrastsFile));
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  // Header cells are the contrast names, e.g. "(A)v(B)".
  return firstLine
    .split(',')
    .map((c) => c.replace(/^"|"$/g, '').trim())
    .filter((c) => /\)v\(/.test(c));
}

export interface LiveImportResult { csv: string; genes: number; idColumn: string; contrast: string; }

// Refuse in-browser slimming above this size — large tables belong to the pipeline.
export const LIVE_IMPORT_MAX_BYTES = 40 * 1024 * 1024;

/**
 * Streams the DE table through the proxy and slims it to
 * `gene_id,log2FoldChange,padj` for one contrast + id column.
 */
export async function liveImportContrast(
  study: OsdrStudy,
  contrast: string,
  idColumn: string,
  onProgress?: (bytes: number) => void
): Promise<LiveImportResult> {
  if (!study.deFile) throw new Error('This study has no processed differential-expression table.');
  if (study.deSizeBytes && study.deSizeBytes > LIVE_IMPORT_MAX_BYTES) {
    throw new Error(
      `The DE table for ${study.osdId} is ${(study.deSizeBytes / 1e6).toFixed(0)} MB — too large to slim in the browser. ` +
      `Use a curated dataset, or run tools/osdr_slim.py to add it to the catalog.`
    );
  }

  const res = await corsFetch(downloadUrl(study.deFile));
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  const out: string[] = ['gene_id,log2FoldChange,padj'];

  let header: string[] | null = null;
  let idIdx = -1, lfcIdx = -1, padjIdx = -1;
  let genes = 0, bytes = 0, buf = '';

  // Quote-aware CSV line splitter: GeneLab DE tables have a GENENAME text column
  // that may contain commas inside double quotes, so a naive split misaligns.
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  };

  const handle = (line: string) => {
    if (!header) {
      header = parseLine(line).map((h) => h.replace(/^"|"$/g, ''));
      idIdx = header.indexOf(idColumn);
      lfcIdx = header.findIndex((h) => h === `Log2fc_${contrast}` || (h.startsWith('Log2fc_') && h.includes(contrast)));
      padjIdx = header.findIndex((h) => h === `Adj.p.value_${contrast}` || (h.startsWith('Adj.p.value_') && h.includes(contrast)));
      if (idIdx < 0 || lfcIdx < 0) throw new Error('Could not locate the id / contrast columns in the DE table.');
      return;
    }
    const cells = parseLine(line);
    const gid = (cells[idIdx] || '').replace(/^"|"$/g, '').trim();
    const lfc = (cells[lfcIdx] || '').trim();
    if (!gid || gid.toUpperCase() === 'NA' || !lfc || lfc.toUpperCase() === 'NA') return;
    const padj = padjIdx >= 0 ? (cells[padjIdx] || '').trim() : '';
    out.push(`${gid},${lfc},${padj}`);
    genes++;
  };

  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.length ?? 0;
      onProgress?.(bytes);
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (line) handle(line);
      }
    }
  } else {
    // No streaming body (some proxies) — fall back to a full read.
    (await res.text()).split(/\r?\n/).forEach((l) => l && handle(l));
  }
  if (buf.trim()) handle(buf.trim());

  return { csv: out.join('\n'), genes, idColumn, contrast };
}

/** Common id columns in GeneLab plant DE tables, best-first for KEGG matching. */
export const OSDR_ID_COLUMNS = ['TAIR', 'ENSEMBL', 'ENTREZID', 'SYMBOL', 'GENENAME'];
