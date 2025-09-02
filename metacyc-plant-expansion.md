# MetaCyc Plant Pathway Expansion Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for expanding the SBGN Pathway Visualizer to become a comprehensive plant pathway visualization platform, leveraging the BioCyc/MetaCyc database with Arabidopsis thaliana as the flagship species.

## Current State vs. Target State

### Current Implementation
- Basic MetaCyc integration with generic species/pathway fetching
- No plant-specific features or categorization
- Limited to ~6 hardcoded plant species in METACROP
- No pathway quality indicators or evidence levels

### Target Implementation
- Comprehensive plant pathway platform with 20+ plant species
- Arabidopsis thaliana (AraCyc) as featured model organism with 311+ pathways
- Plant-specific pathway categorization and metadata
- Quality-based pathway browsing (Tier 1/2/3 curation levels)
- Enhanced user experience for plant biology research

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Establish enhanced plant pathway service architecture

#### 1.1 Update Type Definitions
**File: `types.ts`**
```typescript
// Add to existing types
export interface PlantSpecies extends Species {
  tier: 'Tier1' | 'Tier2' | 'Tier3';
  pathwayCount: number;
  curationLevel: 'Gold' | 'Silver' | 'Bronze';
  commonName: string;
  scientificName: string;
  family?: string;
  isModelOrganism: boolean;
  description?: string;
}

export interface PlantPathway extends Pathway {
  category: PlantPathwayCategory;
  subcategory?: string;
  isPlantSpecific: boolean;
  conservationLevel: 'Universal' | 'Plant-specific' | 'Species-specific';
  evidenceLevel: 'Experimental' | 'Computational' | 'Inferred';
  compoundCount?: number;
  enzymeCount?: number;
}

export enum PlantPathwayCategory {
  PRIMARY_METABOLISM = 'Primary Metabolism',
  SECONDARY_METABOLISM = 'Secondary Metabolism',
  PHOTOSYNTHESIS = 'Photosynthesis',
  PLANT_HORMONES = 'Plant Hormones',
  CELL_WALL = 'Cell Wall Metabolism',
  STRESS_RESPONSE = 'Stress Response',
  DEVELOPMENT = 'Development',
  TRANSPORT = 'Transport'
}

// Update VisualizationConfig for plant-specific options
export interface VisualizationConfig {
  // ... existing fields
  
  // Plant-specific visualization options
  showPlantCompartments?: boolean;
  highlightPlantSpecificEnzymes?: boolean;
  plantColorScheme?: 'Plant' | 'Photosynthesis' | 'Metabolism' | 'Default';
  compareWithArabidopsis?: boolean;
}
```

#### 1.2 Create Plant Species Database
**File: `data/plantSpeciesDatabase.ts`**
```typescript
import { PlantSpecies } from '../types';

export const PLANT_SPECIES_DATABASE: PlantSpecies[] = [
  // Tier 1 - Gold Standard (Fully Curated)
  {
    id: 'aracyc',
    displayName: 'Arabidopsis thaliana (AraCyc)',
    commonName: 'Thale Cress',
    scientificName: 'Arabidopsis thaliana',
    tier: 'Tier1',
    pathwayCount: 311,
    curationLevel: 'Gold',
    isModelOrganism: true,
    family: 'Brassicaceae',
    description: 'Model plant organism with comprehensive pathway curation'
  },
  
  // Tier 2 - High Quality (Partially Curated)
  {
    id: 'ricecyc',
    displayName: 'Oryza sativa (RiceCyc)',
    commonName: 'Rice',
    scientificName: 'Oryza sativa',
    tier: 'Tier2',
    pathwayCount: 35,
    curationLevel: 'Silver',
    isModelOrganism: true,
    family: 'Poaceae',
    description: 'Major cereal crop with curated metabolic pathways'
  },
  {
    id: 'corncyc',
    displayName: 'Zea mays (CornCyc)',
    commonName: 'Maize',
    scientificName: 'Zea mays',
    tier: 'Tier2',
    pathwayCount: 46,
    curationLevel: 'Silver',
    isModelOrganism: true,
    family: 'Poaceae',
    description: 'Important cereal crop with C4 photosynthesis pathways'
  },
  {
    id: 'soybeancyc',
    displayName: 'Glycine max (SoybeanCyc)',
    commonName: 'Soybean',
    scientificName: 'Glycine max',
    tier: 'Tier2',
    pathwayCount: 67,
    curationLevel: 'Silver',
    isModelOrganism: false,
    family: 'Fabaceae',
    description: 'Legume crop with nitrogen fixation pathways'
  },
  
  // Additional Tier 2 species
  {
    id: 'tomatocyc',
    displayName: 'Solanum lycopersicum (TomatoCyc)',
    commonName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    tier: 'Tier2',
    pathwayCount: 28,
    curationLevel: 'Silver',
    isModelOrganism: false,
    family: 'Solanaceae',
    description: 'Important fruit crop with specialized metabolite pathways'
  },
  
  // Tier 3 - Computational (Auto-generated)
  {
    id: 'popcyc',
    displayName: 'Populus trichocarpa (PoplarCyc)',
    commonName: 'Poplar',
    scientificName: 'Populus trichocarpa',
    tier: 'Tier3',
    pathwayCount: 25,
    curationLevel: 'Bronze',
    isModelOrganism: false,
    family: 'Salicaceae',
    description: 'Model tree species for woody plant research'
  },
  {
    id: 'grapecyc',
    displayName: 'Vitis vinifera (GrapeCyc)',
    commonName: 'Grape',
    scientificName: 'Vitis vinifera',
    tier: 'Tier3',
    pathwayCount: 22,
    curationLevel: 'Bronze',
    isModelOrganism: false,
    family: 'Vitaceae',
    description: 'Important fruit crop with secondary metabolite pathways'
  },
  // ... additional species (15+ total)
];

export const FEATURED_PLANT_PATHWAYS = [
  'Calvin-Benson-Bassham cycle',
  'Flavonoid biosynthesis',
  'Auxin biosynthesis',
  'Starch biosynthesis',
  'Photorespiration',
  'Phenylpropanoid biosynthesis',
  'Chlorophyll biosynthesis'
];
```

#### 1.3 Enhanced Plant Pathway Service
**File: `services/plantPathwayService.ts`**
```typescript
import { PlantSpecies, PlantPathway, PlantPathwayCategory } from '../types';
import { PLANT_SPECIES_DATABASE, FEATURED_PLANT_PATHWAYS } from '../data/plantSpeciesDatabase';

const BIOCYC_API_BASE = 'https://websvc.biocyc.org';
const PROXY_URL = 'https://corsproxy.io/?';

export class PlantPathwayService {
  private speciesCache = new Map<string, PlantSpecies[]>();
  private pathwayCache = new Map<string, PlantPathway[]>();
  
  async getPlantSpecies(): Promise<{
    modelOrganisms: PlantSpecies[];
    cropSpecies: PlantSpecies[];
    treeSpecies: PlantSpecies[];
    algae: PlantSpecies[];
    all: PlantSpecies[];
  }> {
    const cacheKey = 'plant_species';
    if (this.speciesCache.has(cacheKey)) {
      return this.categorizeSpecies(this.speciesCache.get(cacheKey)!);
    }
    
    // For now, use curated database. Later can be enhanced with live API calls
    const allSpecies = PLANT_SPECIES_DATABASE;
    this.speciesCache.set(cacheKey, allSpecies);
    
    return this.categorizeSpecies(allSpecies);
  }
  
  private categorizeSpecies(species: PlantSpecies[]) {
    return {
      modelOrganisms: species.filter(s => s.isModelOrganism),
      cropSpecies: species.filter(s => 
        !s.isModelOrganism && 
        ['Poaceae', 'Fabaceae', 'Solanaceae', 'Brassicaceae'].includes(s.family || '')
      ),
      treeSpecies: species.filter(s => 
        ['Salicaceae', 'Vitaceae', 'Rosaceae'].includes(s.family || '')
      ),
      algae: species.filter(s => s.family === 'Chlamydomonadaceae'),
      all: species.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };
  }
  
  async getPlantPathways(speciesId: string): Promise<{
    byCategory: Record<PlantPathwayCategory, PlantPathway[]>;
    featured: PlantPathway[];
    all: PlantPathway[];
  }> {
    const cacheKey = `pathways_${speciesId}`;
    if (this.pathwayCache.has(cacheKey)) {
      const pathways = this.pathwayCache.get(cacheKey)!;
      return this.organizePathways(pathways, speciesId);
    }
    
    try {
      const pathways = await this.fetchPathwaysFromAPI(speciesId);
      this.pathwayCache.set(cacheKey, pathways);
      return this.organizePathways(pathways, speciesId);
    } catch (error) {
      console.error(`Error fetching pathways for ${speciesId}:`, error);
      throw error;
    }
  }
  
  private async fetchPathwaysFromAPI(speciesId: string): Promise<PlantPathway[]> {
    const response = await fetch(`${PROXY_URL}${BIOCYC_API_BASE}/${speciesId}/pathways`);
    if (!response.ok) {
      throw new Error(`BioCyc API returned status ${response.status} for ${speciesId}`);
    }
    
    const xmlText = await response.text();
    return this.parsePathwaysXML(xmlText, speciesId);
  }
  
  private parsePathwaysXML(xmlText: string, speciesId: string): PlantPathway[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");
    const pathwayElements = xmlDoc.getElementsByTagName('Pathway');
    const pathways: PlantPathway[] = [];
    
    for (let i = 0; i < pathwayElements.length; i++) {
      const el = pathwayElements[i];
      const id = el.getAttribute('ID');
      const displayName = el.getAttribute('common-name');
      
      if (id && displayName) {
        const pathway: PlantPathway = {
          id,
          displayName,
          category: this.inferPathwayCategory(displayName),
          isPlantSpecific: this.isPlantSpecificPathway(displayName),
          conservationLevel: this.inferConservationLevel(displayName),
          evidenceLevel: this.inferEvidenceLevel(speciesId)
        };
        pathways.push(pathway);
      }
    }
    
    return pathways.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  
  private organizePathways(pathways: PlantPathway[], speciesId: string) {
    const byCategory = this.categorizePathways(pathways);
    const featured = this.getFeaturedPathways(pathways);
    
    return { byCategory, featured, all: pathways };
  }
  
  // ... additional helper methods for categorization and inference
}

export const plantPathwayService = new PlantPathwayService();
```

### Phase 2: Frontend Integration (Week 2-3)
**Goal**: Create plant-focused user interface components

#### 2.1 Update Sidebar for Plant Species Selection
**File: `components/Sidebar.tsx` - Enhance existing component**
```typescript
// Add plant species selector when MetaCyc is selected
{config.pathwayDatabase === 'MetaCyc' && (
  <PlantSpeciesSelector
    selectedSpecies={config.speciesId}
    onSpeciesChange={(speciesId) => setConfig({...config, speciesId})}
  />
)}
```

#### 2.2 Create Plant Pathway Browser
**File: `components/PlantPathwayBrowser.tsx`**
```typescript
// Component for browsing plant pathways by category
// Includes featured pathways, category tabs, and quality indicators
```

#### 2.3 Update Main App Component
**File: `App.tsx` - Add plant pathway state and logic**
```typescript
// Add plant-specific state management
const [plantPathways, setPlantPathways] = useState<{
  byCategory: Record<PlantPathwayCategory, PlantPathway[]>;
  featured: PlantPathway[];
}>({ byCategory: {}, featured: [] });

// Update handleGenerate to use plant pathway service
const handleGenerate = useCallback(async () => {
  // ... existing validation
  
  if (config.pathwayDatabase === 'MetaCyc' && isPlantSpecies(config.speciesId)) {
    const pathwayData = await plantPathwayService.getPlantPathways(config.speciesId);
    setPlantPathways(pathwayData);
  }
  
  // ... rest of generation logic
}, [geneData, compoundData, config, customSbgnFile]);
```

### Phase 3: Enhanced Features (Week 3-4)
**Goal**: Add advanced plant pathway features

#### 3.1 Pathway Search and Filtering
```typescript
interface PlantPathwaySearch {
  query: string;
  category?: PlantPathwayCategory;
  evidenceLevel?: string[];
  conservationLevel?: string[];
  speciesComparison?: boolean;
}
```

#### 3.2 Plant-Specific Visualization Options
```typescript
interface PlantVisualizationConfig extends VisualizationConfig {
  showChloroplastCompartments: boolean;
  highlightPlantSpecificEnzymes: boolean;
  showConservationLevel: boolean;
  compareWithArabidopsis: boolean;
  plantColorScheme: 'Plant' | 'Photosynthesis' | 'Metabolism';
}
```

#### 3.3 Featured Pathway Recommendations
- Calvin-Benson-Bassham cycle (Primary metabolism)
- Flavonoid biosynthesis (Secondary metabolism)
- Auxin biosynthesis (Plant hormones)
- Chlorophyll biosynthesis (Photosynthesis)
- Starch biosynthesis (Primary metabolism)

### Phase 4: Testing and Optimization (Week 4-5)
**Goal**: Ensure robust plant pathway functionality

#### 4.1 Test Data Preparation
Create test datasets for major plant pathways:
```typescript
// Test data for Arabidopsis Calvin cycle genes
const CALVIN_CYCLE_GENES = [
  'RBCS1A', 'RBCS1B', 'RBCL', 'PRK', 'GAPDH', 'TKL1', 'RPE', 'RPI'
];

// Test data for flavonoid biosynthesis
const FLAVONOID_GENES = [
  'CHS', 'CHI', 'F3H', 'F3\'H', 'DFR', 'ANS', 'UF3GT'
];
```

#### 4.2 Integration Testing
- Test all plant species loading
- Validate pathway categorization accuracy
- Ensure proper error handling for API failures
- Performance testing with large pathway datasets

#### 4.3 User Experience Testing
- Navigation flow for plant researchers
- Pathway discovery and selection
- Visualization quality for plant pathways

## Technical Implementation Details

### API Integration Strategy
```typescript
// Enhanced MetaCyc API client with plant-specific optimizations
class BioCycPlantClient {
  private baseUrl = 'https://websvc.biocyc.org';
  private proxyUrl = 'https://corsproxy.io/?';
  
  async getPlantSpecies(): Promise<PlantSpecies[]> {
    // Fetch from /dbs endpoint and filter for plant organisms
  }
  
  async getPathways(orgId: string): Promise<PlantPathway[]> {
    // Fetch from /{orgId}/pathways with plant-specific parsing
  }
  
  async getPathwayDetails(orgId: string, pathwayId: string): Promise<PathwayDetails> {
    // Fetch detailed pathway information including compounds and reactions
  }
}
```

### Caching Strategy
```typescript
// Multi-level caching for plant pathway data
class PlantPathwayCache {
  private memoryCache = new Map<string, any>();
  private sessionStorage = window.sessionStorage;
  
  // Cache species data for session
  cacheSpecies(species: PlantSpecies[]): void {
    this.sessionStorage.setItem('plant_species', JSON.stringify(species));
  }
  
  // Cache pathway data with TTL
  cachePathways(speciesId: string, pathways: PlantPathway[]): void {
    const cacheData = {
      data: pathways,
      timestamp: Date.now(),
      ttl: 3600000 // 1 hour
    };
    this.sessionStorage.setItem(`pathways_${speciesId}`, JSON.stringify(cacheData));
  }
}
```

### Error Handling Strategy
```typescript
// Plant-specific error handling
class PlantPathwayError extends Error {
  constructor(
    message: string,
    public code: 'SPECIES_NOT_FOUND' | 'PATHWAY_FETCH_FAILED' | 'API_UNAVAILABLE',
    public speciesId?: string
  ) {
    super(message);
    this.name = 'PlantPathwayError';
  }
}

// Error recovery strategies
const handlePlantPathwayError = (error: PlantPathwayError) => {
  switch (error.code) {
    case 'SPECIES_NOT_FOUND':
      return 'Plant species not found. Please select from available species.';
    case 'PATHWAY_FETCH_FAILED':
      return `Failed to load pathways for ${error.speciesId}. Please try again.`;
    case 'API_UNAVAILABLE':
      return 'BioCyc API is currently unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred while loading plant pathways.';
  }
};
```

## Success Metrics

### Functional Metrics
- [ ] 20+ plant species available with proper categorization
- [ ] Arabidopsis pathways load successfully (311+ pathways)
- [ ] Plant pathway categories work correctly (8 categories)
- [ ] Featured pathways display properly
- [ ] Quality indicators show tier/evidence levels

### Performance Metrics
- [ ] Species loading < 2 seconds
- [ ] Pathway loading < 5 seconds
- [ ] Smooth navigation between categories
- [ ] Effective caching reduces API calls

### User Experience Metrics
- [ ] Intuitive plant species selection
- [ ] Clear pathway categorization
- [ ] Helpful quality indicators
- [ ] Responsive plant-focused interface

## Deployment Strategy

### Development Environment
```bash
# Install dependencies
npm install

# Start development server with plant pathway features
npm run dev

# Test plant pathway integration
npm run test:plant-pathways
```

### Production Deployment
```bash
# Build with plant pathway optimizations
npm run build

# Deploy with enhanced MetaCyc integration
npm run deploy
```

## Documentation Updates

### User Documentation
- Plant pathway visualization guide
- Arabidopsis pathway examples
- Species selection tutorial
- Pathway category explanations

### Developer Documentation
- Plant pathway service API
- BioCyc integration patterns
- Caching and performance optimization
- Error handling strategies

## Future Enhancements

### Phase 5: Advanced Features (Future)
- Cross-species pathway comparison
- Pathway evolution analysis
- Integration with plant gene expression databases
- Advanced plant-specific visualizations

### Phase 6: Community Features (Future)
- User pathway annotations
- Community pathway curation
- Pathway sharing and collaboration
- Integration with plant research databases

## Conclusion

This implementation plan transforms the SBGN Pathway Visualizer into a comprehensive plant pathway visualization platform. With Arabidopsis thaliana as the flagship species and support for 20+ plant species across different tiers of curation quality, the platform will serve as a valuable resource for plant biology research.

The phased approach ensures systematic development with proper testing and validation at each stage, resulting in a robust and user-friendly plant pathway visualization tool.