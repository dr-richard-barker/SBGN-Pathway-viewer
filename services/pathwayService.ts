import { type Species, type Pathway, type PathwayDatabase } from '../types';

const REACTOME_API_BASE = 'https://reactome.org/ContentService';
// KEGG and PANTHER APIs are HTTP-only, causing mixed-content errors.
// SMPDB lacks CORS headers. We use a proxy to safely access them.
const PROXY_URL = 'https://corsproxy.io/?';
const KEGG_API_BASE = 'http://rest.kegg.jp';
const PANTHER_API_BASE = 'http://pantherdb.org/services/rest';
const SMPDB_BASE_URL = 'https://smpdb.ca';


async function fetchReactomeSpecies(): Promise<Species[]> {
    try {
        const response = await fetch(`${REACTOME_API_BASE}/data/species/all`);
        if (!response.ok) {
            throw new Error(`Reactome API returned status ${response.status}`);
        }
        const data: any[] = await response.json();
        return data
            .filter(s => s && typeof s.displayName === 'string' && typeof s.dbId === 'number')
            .map(s => ({ id: s.dbId.toString(), displayName: s.displayName }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("Reactome species fetch error:", error);
        throw new Error('Failed to fetch species from Reactome. Check network connection or API status.');
    }
}

async function fetchKeggSpecies(): Promise<Species[]> {
    try {
        const response = await fetch(`${PROXY_URL}${KEGG_API_BASE}/list/organism`);
        if (!response.ok) {
            throw new Error(`KEGG API proxy returned status ${response.status}`);
        }
        const textData = await response.text();
        return textData.trim().split('\n').map(line => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
                return {
                    id: parts[1], 
                    displayName: parts[2], 
                };
            }
            return null;
        }).filter((s): s is Species => s !== null)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("KEGG species fetch error:", error);
        throw new Error('Failed to fetch species from KEGG. The CORS proxy may be down.');
    }
}

async function fetchMetaCycSpecies(): Promise<Species[]> {
    try {
        const response = await fetch('https://websvc.biocyc.org/dbs'); 
        if (!response.ok) {
            throw new Error(`BioCyc API returned status ${response.status}`);
        }
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        const dbElements = xmlDoc.getElementsByTagName('ptools-db');
        const speciesList: Species[] = [];
        for (let i = 0; i < dbElements.length; i++) {
            const el = dbElements[i];
            const id = el.getAttribute('orgid');
            const displayName = el.getAttribute('name');
            if (id && displayName) {
                speciesList.push({ id, displayName });
            }
        }
        return speciesList.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("MetaCyc species fetch error:", error);
        throw new Error('Failed to fetch species from MetaCyc. Check network connection or API status.');
    }
}

async function fetchSmpdbSpecies(): Promise<Species[]> {
    try {
        const response = await fetch(`${PROXY_URL}${SMPDB_BASE_URL}/pathways.json`);
        if (!response.ok) {
            throw new Error(`SMPDB API proxy returned status ${response.status}`);
        }
        const data: any[] = await response.json();
        const speciesMap = new Map<string, string>();
        data.forEach(pathway => {
            if (pathway.species_taxonomy_id && pathway.species_name) {
                speciesMap.set(pathway.species_taxonomy_id, pathway.species_name);
            }
        });
        const speciesList: Species[] = Array.from(speciesMap, ([id, displayName]) => ({ id, displayName }));
        return speciesList.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("SMPDB species fetch error:", error);
        throw new Error('Failed to fetch species from SMPDB. Check network connection or API status.');
    }
}

async function fetchPantherSpecies(): Promise<Species[]> {
    try {
        const response = await fetch(`${PROXY_URL}${PANTHER_API_BASE}/organism/list`);
        if (!response.ok) {
            throw new Error(`PANTHER API proxy returned status ${response.status}`);
        }
        const data = await response.json();
        if (!data?.search?.organism_list?.organism) {
            console.warn("Unexpected PANTHER species response format:", data);
            return [];
        }
        const organisms: any[] = data.search.organism_list.organism;
        return organisms
            .filter(o => o.taxon_id && o.long_name)
            .map(o => ({ id: o.taxon_id.toString(), displayName: o.long_name }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("PANTHER species fetch error:", error);
        throw new Error('Failed to fetch species from PANTHER. The CORS proxy may be down.');
    }
}


export async function fetchSpecies(database: PathwayDatabase): Promise<Species[]> {
    switch (database) {
        case 'Reactome':
            return fetchReactomeSpecies();
        case 'KEGG':
            return fetchKeggSpecies();
        case 'MetaCyc':
            return fetchMetaCycSpecies();
        case 'SMPDB':
            return fetchSmpdbSpecies();
        case 'PANTHER':
            return fetchPantherSpecies();
        case 'METACROP':
            console.warn(`Species fetching is not implemented for ${database}.`);
            return [];
        default:
            return [];
    }
}


async function fetchReactomePathways(speciesId: string): Promise<Pathway[]> {
    try {
        const response = await fetch(`${REACTOME_API_BASE}/data/pathways/low/species/${speciesId}`);
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`Reactome API returned status ${response.status}`);
        }
        const data: any[] = await response.json();
        return data
            .filter(p => p && typeof p.displayName === 'string' && typeof p.stId === 'string')
            .map(p => ({ id: p.stId, displayName: p.displayName }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("Reactome pathways fetch error:", error);
        throw new Error('Failed to fetch pathways from Reactome. Check network connection or API status.');
    }
}

async function fetchKeggPathways(speciesId: string): Promise<Pathway[]> {
   try {
        const response = await fetch(`${PROXY_URL}${KEGG_API_BASE}/list/pathway/${speciesId}`);
        if (!response.ok) {
            throw new Error(`KEGG API proxy returned status ${response.status} for species ${speciesId}`);
        }
        const textData = await response.text();
        if (!textData.trim()) {
            return [];
        }
        const pathways = textData.trim().split('\n').map(line => {
            const [id, displayName] = line.split('\t');
            if (id && displayName) {
                return { id: id.replace('path:', ''), displayName };
            }
            return null;
        }).filter((p): p is Pathway => p !== null);
        
        return pathways.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("KEGG pathways fetch error:", error);
        throw new Error('Failed to fetch pathways from KEGG. The CORS proxy may be down.');
    }
}

async function fetchSmpdbPathways(speciesId: string): Promise<Pathway[]> {
    try {
        const response = await fetch(`${PROXY_URL}${SMPDB_BASE_URL}/pathways.json`);
        if (!response.ok) {
            throw new Error(`SMPDB API proxy returned status ${response.status}`);
        }
        const data: any[] = await response.json();
        const pathways = data
            .filter(p => p.species_taxonomy_id === speciesId && p.smp_id && p.name)
            .map(p => ({ id: p.smp_id, displayName: p.name }));

        return pathways.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("SMPDB pathways fetch error:", error);
        throw new Error('Failed to fetch pathways from SMPDB. Check network connection or API status.');
    }
}

async function fetchPantherPathways(speciesId: string): Promise<Pathway[]> {
    try {
        const response = await fetch(`${PROXY_URL}${PANTHER_API_BASE}/pathway/pathwaysForOrganism?organism=${speciesId}`);
        if (!response.ok) {
            throw new Error(`PANTHER API proxy returned status ${response.status} for species ${speciesId}`);
        }
        const data = await response.json();
        if (!data?.search?.pathway_list?.pathway) {
            return [];
        }
        const pathways: any[] = data.search.pathway_list.pathway;
        return pathways
            .filter(p => p.id && p.name)
            .map(p => ({ id: p.id, displayName: p.name }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("PANTHER pathways fetch error:", error);
        throw new Error('Failed to fetch pathways from PANTHER. The CORS proxy may be down.');
    }
}

async function fetchMetaCycPathways(speciesId: string): Promise<Pathway[]> {
    try {
        const response = await fetch(`https://websvc.biocyc.org/${speciesId}/pathways`);
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`BioCyc API returned status ${response.status} for species ${speciesId}`);
        }
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        const pathwayElements = xmlDoc.getElementsByTagName('Pathway');
        const pathways: Pathway[] = [];
        for (let i = 0; i < pathwayElements.length; i++) {
            const el = pathwayElements[i];
            const id = el.getAttribute('ID');
            const displayName = el.getAttribute('common-name');
            if (id && displayName) {
                pathways.push({ id, displayName });
            }
        }
        return pathways.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
        console.error("MetaCyc pathways fetch error:", error);
        throw new Error('Failed to fetch pathways from MetaCyc. Check network connection or API status.');
    }
}

export async function fetchPathways(database: PathwayDatabase, speciesId: string): Promise<Pathway[]> {
    if (!speciesId) return [];
    switch (database) {
        case 'Reactome':
            return fetchReactomePathways(speciesId);
        case 'KEGG':
            return fetchKeggPathways(speciesId);
        case 'SMPDB':
            return fetchSmpdbPathways(speciesId);
        case 'PANTHER':
            return fetchPantherPathways(speciesId);
        case 'MetaCyc':
            return fetchMetaCycPathways(speciesId);
        case 'METACROP':
            console.warn(`Pathway fetching is not implemented for ${database}.`);
            return [];
        default:
            return [];
    }
}


/**
 * Maps a list of gene identifiers to Reactome pathways.
 * NOTE: This function is specific to the Reactome database.
 * @param speciesId The database ID of the species (for Reactome, this is the dbId).
 * @param geneIds An array of gene identifiers (e.g., symbols).
 * @returns A promise that resolves to a Set of pathway stable IDs (stId).
 */
export async function mapGenesToPathways(speciesId: string, geneIds: string[]): Promise<Set<string>> {
    try {
        const response = await fetch(`${REACTOME_API_BASE}/data/mapping/${speciesId}/identifier`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Accept': 'application/json',
            },
            body: geneIds.join(','),
        });

        if (!response.ok) {
            throw new Error(`Reactome mapping API returned status ${response.status}`);
        }

        const data = await response.json();
        const pathwayStIds = new Set<string>();
        
        if (data.pathways) {
            data.pathways.forEach((pathway: { stId: string }) => {
                pathwayStIds.add(pathway.stId);
            });
        }
        
        return pathwayStIds;

    } catch (error) {
        console.error("Failed to map genes to Reactome pathways:", error);
        return new Set(); // Return empty set on error
    }
}

/**
 * Maps a list of gene identifiers to KEGG pathways.
 * @param speciesId The KEGG organism code (e.g., 'hsa' for human).
 * @param geneIds An array of gene identifiers (e.g., symbols).
 * @returns A promise that resolves to a Set of KEGG pathway IDs.
 */
export async function mapGenesToPathwaysKegg(speciesId: string, geneIds: string[]): Promise<Set<string>> {
    if (!speciesId || geneIds.length === 0) {
        return new Set();
    }
    try {
        // Step 1: Convert gene symbols to KEGG IDs
        const findPromises = geneIds.map(geneId =>
            fetch(`${PROXY_URL}${KEGG_API_BASE}/find/genes/${encodeURIComponent(geneId)}`)
                .then(res => res.ok ? res.text() : Promise.resolve(''))
        );
        
        const findResults = await Promise.all(findPromises);

        const keggGeneIds = new Set<string>();
        findResults.forEach(textResult => {
            if (textResult) {
                const lines = textResult.trim().split('\n');
                lines.forEach(line => {
                    // Only match the entry for the correct species to avoid ambiguity
                    if (line.startsWith(`${speciesId}:`)) {
                        const keggId = line.split('\t')[0];
                        keggGeneIds.add(keggId);
                    }
                });
            }
        });

        if (keggGeneIds.size === 0) {
            return new Set(); // No genes mapped, return early
        }

        // Step 2: Link KEGG gene IDs to pathways in a single batch request
        const keggIdsString = Array.from(keggGeneIds).join('+');
        const linkResponse = await fetch(`${PROXY_URL}${KEGG_API_BASE}/link/pathway/${keggIdsString}`);
        if (!linkResponse.ok) {
            // It can fail with a 404 if no links are found, which is not a critical error.
            if (linkResponse.status === 404) return new Set();
            throw new Error(`KEGG link API returned status ${linkResponse.status}`);
        }
        
        const linkText = await linkResponse.text();
        const pathwayIds = new Set<string>();
        linkText.trim().split('\n').forEach(line => {
            if (line) {
                const parts = line.split('\t');
                if (parts.length > 1) {
                    // pathway ID is like 'path:hsa04110', we want 'hsa04110'
                    pathwayIds.add(parts[1].replace('path:', ''));
                }
            }
        });

        return pathwayIds;

    } catch (error) {
        console.error("Failed to map genes to KEGG pathways:", error);
        return new Set(); // Return empty set on error
    }
}