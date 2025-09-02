# Enhanced Plant Pathway Architecture for MetaCyc Integration

## Overview
Based on comprehensive research of the BioCyc/MetaCyc database structure, this document outlines the architecture for adding robust plant pathway support, with Arabidopsis thaliana as the flagship species and comprehensive coverage of other plant species.

## Current State Analysis

### Existing MetaCyc Integration Limitations
- Basic species/pathway fetching without plant-specific filtering
- No pathway categorization or hierarchy support
- Missing plant-specific metadata and quality indicators
- Limited to generic BioCyc API calls without plant optimization

### Key Issues to Address
1. **Species Coverage**: Current implementation doesn't prioritize plant species
2. **Pathway Organization**: No categorization of plant-specific pathways
3. **Data Quality**: No distinction between curated vs. computational pathways
4. **User Experience**: No plant-focused navigation or search

## Enhanced Architecture Design

### 1. Plant Species Hierarchy

```typescript
interface PlantSpecies extends Species {
  tier: 'Tier1' | 'Tier2' | 'Tier3';
  pathwayCount: number;
  curationLevel: 'Gold' | 'Silver' | 'Bronze';
  commonName: string;
  scientificName: string;
  family?: string;
  order?: string;
  isModelOrganism: boolean;
}

interface PlantDatabase {
  plants: {
    modelOrganisms: PlantSpecies[];    // Arabidopsis, Rice, Maize, etc.
    cropSpecies: PlantSpecies[];       // Soybean, Tomato, Potato, etc.
    treeSpecies: PlantSpecies[];       // Poplar, Eucalyptus, etc.
    algae: PlantSpecies[];             // Chlamydomonas, etc.
  };
}
```

### 2. Plant Pathway Categories

```typescript
enum PlantPathwayCategory {
  PRIMARY_METABOLISM = 'Primary Metabolism',
  SECONDARY_METABOLISM = 'Secondary Metabolism', 
  PHOTOSYNTHESIS = 'Photosynthesis',
  PLANT_HORMONES = 'Plant Hormones',
  CELL_WALL = 'Cell Wall Metabolism',
  STRESS_RESPONSE = 'Stress Response',
  DEVELOPMENT = 'Development',
  TRANSPORT = 'Transport'
}

interface PlantPathway extends Pathway {
  category: PlantPathwayCategory;
  subcategory?: string;
  isPlantSpecific: boolean;
  conservationLevel: 'Universal' | 'Plant-specific' | 'Species-specific';
  evidenceLevel: 'Experimental' | 'Computational' | 'Inferred';
  relatedPathways: string[];
  compounds: string[];
  enzymes: string[];
}
```

### 3. Enhanced Service Architecture

```typescript
class PlantPathwayService {
  private baseService: PathwayService;
  private plantSpeciesCache: Map<string, PlantSpecies[]>;
  private pathwayCategoryCache: Map<string, PlantPathway[]>;
  
  // Plant-specific species fetching
  async getPlantSpecies(): Promise<PlantDatabase> {
    const allSpecies = await this.fetchBioCycSpecies();
    return this.categorizePlantSpecies(allSpecies);
  }
  
  // Enhanced pathway fetching with categorization
  async getPlantPathways(speciesId: string): Promise<{
    byCategory: Map<PlantPathwayCategory, PlantPathway[]>;
    featured: PlantPathway[];
    all: PlantPathway[];
  }> {
    const pathways = await this.fetchPathwaysWithMetadata(speciesId);
    return this.categorizePathways(pathways);
  }
  
  // Cross-species pathway comparison
  async comparePathwaysAcrossSpecies(
    pathwayId: string, 
    speciesIds: string[]
  ): Promise<PathwayComparison[]> {
    // Implementation for comparative analysis
  }
}
```

## Key Plant Species to Prioritize

### Tier 1 (Gold Standard - Fully Curated)
```typescript
const TIER1_PLANTS: PlantSpecies[] = [
  {
    id: 'aracyc',
    displayName: 'Arabidopsis thaliana',
    commonName: 'Thale Cress',
    scientificName: 'Arabidopsis thaliana',
    tier: 'Tier1',
    pathwayCount: 311,
    curationLevel: 'Gold',
    isModelOrganism: true,
    family: 'Brassicaceae'
  }
];
```

### Tier 2 (High Quality - Partially Curated)
```typescript
const TIER2_PLANTS: PlantSpecies[] = [
  {
    id: 'ricecyc',
    displayName: 'Oryza sativa',
    commonName: 'Rice',
    scientificName: 'Oryza sativa',
    tier: 'Tier2',
    pathwayCount: 35,
    curationLevel: 'Silver',
    isModelOrganism: true,
    family: 'Poaceae'
  },
  {
    id: 'corncyc',
    displayName: 'Zea mays',
    commonName: 'Maize',
    scientificName: 'Zea mays',
    tier: 'Tier2',
    pathwayCount: 46,
    curationLevel: 'Silver',
    isModelOrganism: true,
    family: 'Poaceae'
  },
  {
    id: 'soybeancyc',
    displayName: 'Glycine max',
    commonName: 'Soybean',
    scientificName: 'Glycine max',
    tier: 'Tier2',
    pathwayCount: 67,
    curationLevel: 'Silver',
    isModelOrganism: false,
    family: 'Fabaceae'
  }
];
```

### Tier 3 (Computational - Auto-generated)
```typescript
const TIER3_PLANTS: PlantSpecies[] = [
  // 15+ additional plant species with computational pathways
  { id: 'popcyc', displayName: 'Populus trichocarpa', commonName: 'Poplar' },
  { id: 'grapecyc', displayName: 'Vitis vinifera', commonName: 'Grape' },
  { id: 'tomatocyc', displayName: 'Solanum lycopersicum', commonName: 'Tomato' },
  // ... more species
];
```

## Plant Pathway Categories Implementation

### 1. Primary Metabolism Pathways
```typescript
const PRIMARY_METABOLISM_PATHWAYS = [
  'Calvin-Benson-Bassham cycle',
  'Photorespiration',
  'Starch biosynthesis',
  'Sucrose biosynthesis',
  'Glycolysis',
  'TCA cycle',
  'Pentose phosphate pathway'
];
```

### 2. Secondary Metabolism Pathways
```typescript
const SECONDARY_METABOLISM_PATHWAYS = [
  'Flavonoid biosynthesis',
  'Phenylpropanoid biosynthesis',
  'Terpenoid biosynthesis',
  'Alkaloid biosynthesis',
  'Glucosinolate biosynthesis'
];
```

### 3. Plant Hormone Pathways
```typescript
const PLANT_HORMONE_PATHWAYS = [
  'Auxin biosynthesis',
  'Cytokinin biosynthesis',
  'Gibberellin biosynthesis',
  'Abscisic acid biosynthesis',
  'Ethylene biosynthesis',
  'Brassinosteroid biosynthesis'
];
```

## Enhanced API Endpoints

### New Plant-Specific Endpoints
```typescript
interface PlantPathwayAPI {
  // Get plant species organized by tier and type
  '/api/plants/species': {
    response: PlantDatabase;
  };
  
  // Get pathways for a plant species with categorization
  '/api/plants/{speciesId}/pathways': {
    response: {
      byCategory: Record<PlantPathwayCategory, PlantPathway[]>;
      featured: PlantPathway[];
      modelPathways: PlantPathway[];
    };
  };
  
  // Search plant pathways across species
  '/api/plants/pathways/search': {
    params: {
      query: string;
      category?: PlantPathwayCategory;
      species?: string[];
      evidenceLevel?: string;
    };
    response: PlantPathway[];
  };
  
  // Compare pathway across plant species
  '/api/plants/pathways/{pathwayId}/compare': {
    params: { species: string[] };
    response: PathwayComparison[];
  };
}
```

## User Interface Enhancements

### 1. Plant-Focused Species Selection
```typescript
interface PlantSpeciesSelector {
  tabs: ['Model Organisms', 'Crop Species', 'Tree Species', 'Algae'];
  featured: PlantSpecies[];  // Arabidopsis, Rice, Maize prominently displayed
  search: {
    byCommonName: boolean;
    byFamily: boolean;
    byTier: boolean;
  };
}
```

### 2. Pathway Category Navigation
```typescript
interface PlantPathwayBrowser {
  categories: PlantPathwayCategory[];
  featuredPathways: {
    'Calvin Cycle': PlantPathway;
    'Flavonoid Biosynthesis': PlantPathway;
    'Auxin Biosynthesis': PlantPathway;
  };
  recentlyViewed: PlantPathway[];
  bookmarks: PlantPathway[];
}
```

### 3. Enhanced Visualization Options
```typescript
interface PlantVisualizationConfig extends VisualizationConfig {
  // Plant-specific visualization options
  showChloroplastCompartments: boolean;
  highlightPlantSpecificEnzymes: boolean;
  showConservationLevel: boolean;
  compareWithArabidopsis: boolean;
  
  // Color schemes optimized for plant pathways
  colorScheme: 'Plant' | 'Photosynthesis' | 'Metabolism' | 'Default';
}
```

## Implementation Phases

### Phase 1: Core Plant Species Support (Week 1-2)
- Implement enhanced MetaCyc species fetching with plant categorization
- Add Arabidopsis as featured model organism
- Create plant species hierarchy and metadata

### Phase 2: Pathway Categorization (Week 2-3)
- Implement plant pathway categories
- Add pathway metadata enrichment
- Create category-based pathway browsing

### Phase 3: Enhanced User Experience (Week 3-4)
- Plant-focused UI components
- Featured pathway recommendations
- Search and filtering improvements

### Phase 4: Advanced Features (Week 4-5)
- Cross-species pathway comparison
- Plant-specific visualization options
- Pathway conservation analysis

## Benefits

1. **Research Focus**: Prioritizes plant biology research needs
2. **Data Quality**: Distinguishes between curated and computational data
3. **User Experience**: Plant-specific navigation and discovery
4. **Comparative Analysis**: Cross-species pathway comparison
5. **Scalability**: Architecture supports adding more plant species
6. **Scientific Accuracy**: Uses established BioCyc tier system

## Integration with Existing System

The enhanced plant pathway architecture builds on the existing MetaCyc integration while adding plant-specific enhancements. It maintains backward compatibility while providing specialized plant biology features.

This architecture transforms the current basic MetaCyc integration into a comprehensive plant pathway visualization platform, with AraCyc (Arabidopsis) as the gold standard and broad plant species coverage for comparative research.