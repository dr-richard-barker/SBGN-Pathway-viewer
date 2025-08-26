import { type DataType } from '../types';

const MAX_GENES_TO_SEND = 500;

/**
 * Parses a CSV or TSV string into headers and rows.
 * @param data The raw string data.
 * @returns An object with headers and rows.
 */
const parseData = (data: string): { headers: string[], rows: string[][] } => {
    const lines = data.trim().split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }
    const delimiter = lines[0].includes(',') ? ',' : '\t';
    const headers = lines[0].split(delimiter).map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(delimiter).map(col => col.trim()));
    return { headers, rows };
};

/**
 * Converts headers and rows back into a CSV string.
 * @param headers The column headers.
 * @param rows The data rows.
 * @returns A CSV formatted string.
 */
const stringifyData = (headers: string[], rows: string[][]): string => {
    if (headers.length === 0) return '';
    const headerString = headers.join(',');
    const rowStrings = rows.map(row => row.join(','));
    return [headerString, ...rowStrings].join('\n');
};

/**
 * Summarizes gene expression data to a manageable size for the API.
 * For DESeq2 data, it prioritizes genes with the lowest p-adjusted value.
 * For Normalized Counts, it prioritizes genes with the highest absolute expression values.
 * @param geneData The raw gene expression data as a string.
 * @param dataType The type of data ('norm_counts' or 'deseq2').
 * @returns A summarized version of the data as a CSV string.
 */
export const summarizeGeneData = (geneData: string, dataType: DataType): string => {
    const { headers, rows } = parseData(geneData);
    
    if (rows.length <= MAX_GENES_TO_SEND) {
        return geneData;
    }

    if (rows.length === 0) {
        return stringifyData(headers, []);
    }

    let summarizedRows: string[][];

    if (dataType === 'deseq2') {
        const pAdjIndex = headers.findIndex(h => /padj|p\.adj|fdr/i.test(h));
        
        if (pAdjIndex !== -1) {
            summarizedRows = rows
                .map(row => ({ original: row, padj: parseFloat(row[pAdjIndex]) }))
                .filter(item => !isNaN(item.padj))
                .sort((a, b) => a.padj - b.padj)
                .slice(0, MAX_GENES_TO_SEND)
                .map(item => item.original);
        } else {
            // Fallback for deseq2 if no p-value column is found
            summarizedRows = rows.slice(0, MAX_GENES_TO_SEND);
        }
    } else { // 'norm_counts'
        // Assume the second column contains the expression values.
        const valueIndex = rows[0].length > 1 ? 1 : 0;
        
        summarizedRows = rows
            .map(row => ({ original: row, value: Math.abs(parseFloat(row[valueIndex])) }))
            .filter(item => !isNaN(item.value))
            .sort((a, b) => b.value - a.value)
            .slice(0, MAX_GENES_TO_SEND)
            .map(item => item.original);
    }

    // If summarization resulted in no rows (e.g., parsing errors), fallback to truncation
    if (summarizedRows.length === 0) {
        summarizedRows = rows.slice(0, MAX_GENES_TO_SEND);
    }

    return stringifyData(headers, summarizedRows);
};

/**
 * Parses the raw data string to extract a list of unique gene IDs from the first column.
 * @param geneData The raw gene expression data as a string.
 * @returns An array of unique gene ID strings.
 */
export const parseGeneIds = (geneData: string): string[] => {
    const { rows } = parseData(geneData);
    const geneIds = rows.map(row => row[0]).filter(Boolean); // Get first column and filter out empty strings
    return [...new Set(geneIds)]; // Return unique IDs
};

/**
 * Parses raw data string into a Map for easy lookup.
 * @param data The raw data string (CSV/TSV).
 * @returns A Map where the key is the identifier from the first column and the value is an object of the row data.
 */
export const parseDataToMap = (data: string): Map<string, Record<string, string>> => {
    const dataMap = new Map<string, Record<string, string>>();
    const { headers, rows } = parseData(data);

    if (headers.length === 0 || rows.length === 0) {
        return dataMap;
    }

    rows.forEach(row => {
        const identifier = row[0];
        if (identifier) {
            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
                rowData[header] = row[index];
            });
            dataMap.set(identifier, rowData);
        }
    });

    return dataMap;
};
