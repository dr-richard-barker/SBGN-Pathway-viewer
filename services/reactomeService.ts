import { type Species, type Pathway } from '../types';

const REACTOME_API_BASE = 'https://reactome.org/ContentService';

/**
 * Fetches a list of all species from Reactome.
 * @returns A promise that resolves to an array of Species objects.
 */
export async function fetchSpecies(): Promise<Species[]> {
    const response = await fetch(`${REACTOME_API_BASE}/data/species/all`);
    if (!response.ok) {
        throw new Error('Failed to fetch species from Reactome API');
    }
    const data: any[] = await response.json();
    // Filter for valid species objects before sorting to prevent errors on malformed data.
    return data
        .filter((s): s is Species => s && typeof s.displayName === 'string' && typeof s.dbId === 'number')
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Fetches all top-level pathways for a given species.
 * @param speciesDbId The database ID of the species.
 * @returns A promise that resolves to an array of Pathway objects.
 */
export async function fetchPathways(speciesDbId: number): Promise<Pathway[]> {
    const response = await fetch(`${REACTOME_API_BASE}/data/pathways/top/${speciesDbId}`);
    if (!response.ok) {
        // A 404 error from this endpoint often means the species exists but has no top-level pathways defined.
        // We can treat this as a valid, empty response rather than a critical failure.
        if (response.status === 404) {
            return []; // Return an empty array gracefully.
        }
        // For other server errors or network issues, we should still throw.
        throw new Error('Failed to fetch pathways from Reactome API');
    }
    const data: any[] = await response.json();
    // Filter for valid pathway objects before sorting to prevent errors on malformed data.
    return data
        .filter((p): p is Pathway => p && typeof p.displayName === 'string' && typeof p.stId === 'string')
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}


/**
 * Maps a list of gene identifiers to Reactome pathways.
 * @param speciesDbId The database ID of the species.
 * @param geneIds An array of gene identifiers (e.g., symbols).
 * @returns A promise that resolves to a Set of pathway stable IDs (stId).
 */
export async function mapGenesToPathways(speciesDbId: number, geneIds: string[]): Promise<Set<string>> {
    try {
        const response = await fetch(`${REACTOME_API_BASE}/data/mapping/${speciesDbId}/identifier`, {
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
        console.error("Failed to map genes to pathways:", error);
        return new Set(); // Return empty set on error
    }
}