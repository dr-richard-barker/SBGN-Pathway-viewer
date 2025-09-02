# Arabidopsis and Plant Pathway Integration Plan

## Overview
This document provides a detailed implementation plan for integrating Arabidopsis thaliana and other plant pathways from the BioCyc/MetaCyc database, transforming the current basic MetaCyc integration into a comprehensive plant pathway visualization platform.

## Phase 1: Enhanced MetaCyc Service Implementation

### 1.1 Update Plant Species Data Structure

**File: `types.ts` - Add plant-specific types:**
```typescript
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
```

### 1.2 Create Enhanced Plant Pathway Service

**File: `services/plantPathwayService.ts`:**
```typescript
import { PlantSpecies, PlantPathway, PlantPathwayCategory } from '../types';

const BIOCYC_API_BASE = 'https://websvc.biocyc.org';
const PROXY_URL = 'https://corsproxy.io/?';

// Curated list of plant species with metadata
const PLANT_SPECIES_DATABASE: PlantSpecies[] = [
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
  }
];

// Plant pathway categories with featured pathways
const PLANT_PATHWAY_CATEGORIES = {
  [PlantPathwayCategory.PRIMARY_METABOLISM]: [
    'Calvin-Benson-Bassham cycle',
    'Photorespiration',
    'Starch biosynthesis',
    'Sucrose biosynthesis',
    'Glycolysis',
    'TCA cycle'
  ],
  [PlantPathwayCategory.SECONDARY_METABOLISM]: [
    'Flavonoid biosynthesis',
    'Phenylpropanoid biosynthesis',
    'Terpenoid biosynthesis',
    'Glucosinolate biosynthesis'
  ],
  [PlantPathwayCategory.PHOTOSYNTHESIS]: [
    'Photosystem I',
    'Photosystem II',
    'Chlorophyll biosynthesis',
    'Carotenoid biosynthesis'
  ],
  [PlantPathwayCategory.PLANT_HORMONES]: [
    'Auxin biosynthesis',
    'Cytokinin biosynthesis',
    'Gibberellin biosynthesis',
    'Abscisic acid biosynthesis'
  ]
};

export class PlantPathwayService {
  
  async getPlantSpecies(): Promise<{
    modelOrganisms: PlantSpecies[];
    cropSpecies: PlantSpecies[];
    treeSpecies: PlantSpecies[];
    all: PlantSpecies[];
  }> {
    const modelOrganisms = PLANT_SPECIES_DATABASE.filter(s => s.isModelOrganism);
    const cropSpecies = PLANT_SPECIES_DATABASE.filter(s => 
      !s.isModelOrganism && ['Poaceae', 'Fabaceae', 'Solanaceae'].includes(s.family || '')
    );
    const treeSpecies = PLANT_SPECIES_DATABASE.filter(s => 
      ['Salicaceae', 'Vitaceae'].includes(s.family || '')
    );
    
    return {
      modelOrganisms: modelOrganisms.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      cropSpecies: cropSpecies.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      treeSpecies: treeSpecies.sort((a, b) => a.displayName.localeCompare(b.displayName)),
      all: PLANT_SPECIES_DATABASE.sort((a, b) => a.displayName.localeCompare(b.displayName))
    };
  }
  
  async getPlantPathways(speciesId: string): Promise<{
    byCategory: Record<PlantPathwayCategory, PlantPathway[]>;
    featured: PlantPathway[];
    all: PlantPathway[];
  }> {
    try {
      // Fetch pathways from BioCyc API
      const response = await fetch(`${PROXY_URL}${BIOCYC_API_BASE}/${speciesId}/pathways`);
      if (!response.ok) {
        throw new Error(`BioCyc API returned status ${response.status}`);
      }
      
      const xmlText = await response.text();
      const pathways = this.parsePathwaysXML(xmlText, speciesId);
      const categorizedPathways = this.categorizePathways(pathways);
      const featuredPathways = this.getFeaturedPathways(pathways, speciesId);
      
      return {
        byCategory: categorizedPathways,
        featured: featuredPathways,
        all: pathways
      };
    } catch (error) {
      console.error(`Error fetching plant pathways for ${speciesId}:`, error);
      throw new Error(`Failed to fetch plant pathways for ${speciesId}`);
    }
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
          conservationLevel: this.inferConservationLevel(displayName, speciesId),
          evidenceLevel: this.inferEvidenceLevel(speciesId)
        };
        pathways.push(pathway);
      }
    }
    
    return pathways.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  
  private categorizePathways(pathways: PlantPathway[]): Record<PlantPathwayCategory, PlantPathway[]> {
    const categorized: Record<PlantPathwayCategory, PlantPathway[]> = {
      [PlantPathwayCategory.PRIMARY_METABOLISM]: [],
      [PlantPathwayCategory.SECONDARY_METABOLISM]: [],
      [PlantPathwayCategory.PHOTOSYNTHESIS]: [],
      [PlantPathwayCategory.PLANT_HORMONES]: [],
      [PlantPathwayCategory.CELL_WALL]: [],
      [PlantPathwayCategory.STRESS_RESPONSE]: [],
      [PlantPathwayCategory.DEVELOPMENT]: [],
      [PlantPathwayCategory.TRANSPORT]: []
    };
    
    pathways.forEach(pathway => {
      categorized[pathway.category].push(pathway);
    });
    
    return categorized;
  }
  
  private getFeaturedPathways(pathways: PlantPathway[], speciesId: string): PlantPathway[] {
    const featuredNames = [
      'Calvin-Benson-Bassham cycle',
      'Flavonoid biosynthesis',
      'Auxin biosynthesis',
      'Starch biosynthesis',
      'Photorespiration'
    ];
    
    return pathways.filter(p => 
      featuredNames.some(name => p.displayName.toLowerCase().includes(name.toLowerCase()))
    ).slice(0, 5);
  }
  
  private inferPathwayCategory(pathwayName: string): PlantPathwayCategory {
    const name = pathwayName.toLowerCase();
    
    if (name.includes('calvin') || name.includes('starch') || name.includes('sucrose') || 
        name.includes('glycolysis') || name.includes('tca')) {
      return PlantPathwayCategory.PRIMARY_METABOLISM;
    }
    if (name.includes('flavonoid') || name.includes('phenylpropanoid') || 
        name.includes('terpenoid') || name.includes('alkaloid')) {
      return PlantPathwayCategory.SECONDARY_METABOLISM;
    }
    if (name.includes('photosystem') || name.includes('chlorophyll') || 
        name.includes('carotenoid') || name.includes('photorespiration')) {
      return PlantPathwayCategory.PHOTOSYNTHESIS;
    }
    if (name.includes('auxin') || name.includes('cytokinin') || 
        name.includes('gibberellin') || name.includes('abscisic')) {
      return PlantPathwayCategory.PLANT_HORMONES;
    }
    if (name.includes('cellulose') || name.includes('lignin') || name.includes('pectin')) {
      return PlantPathwayCategory.CELL_WALL;
    }
    
    return PlantPathwayCategory.PRIMARY_METABOLISM; // Default
  }
  
  private isPlantSpecificPathway(pathwayName: string): boolean {
    const plantSpecificKeywords = [
      'calvin', 'photorespiration', 'chlorophyll', 'carotenoid',
      'auxin', 'cytokinin', 'gibberellin', 'cellulose', 'lignin'
    ];
    
    return plantSpecificKeywords.some(keyword => 
      pathwayName.toLowerCase().includes(keyword)
    );
  }
  
  private inferConservationLevel(pathwayName: string, speciesId: string): 'Universal' | 'Plant-specific' | 'Species-specific' {
    if (this.isPlantSpecificPathway(pathwayName)) {
      return 'Plant-specific';
    }
    
    const universalPathways = ['glycolysis', 'tca cycle', 'pentose phosphate'];
    if (universalPathways.some(p => pathwayName.toLowerCase().includes(p))) {
      return 'Universal';
    }
    
    return 'Species-specific';
  }
  
  private inferEvidenceLevel(speciesId: string): 'Experimental' | 'Computational' | 'Inferred' {
    const species = PLANT_SPECIES_DATABASE.find(s => s.id === speciesId);
    if (!species) return 'Inferred';
    
    switch (species.tier) {
      case 'Tier1': return 'Experimental';
      case 'Tier2': return 'Experimental';
      case 'Tier3': return 'Computational';
      default: return 'Inferred';
    }
  }
}

export const plantPathwayService = new PlantPathwayService();
```

## Phase 2: Frontend Integration

### 2.1 Update Sidebar Component for Plant Species

**File: `components/PlantSpeciesSelector.tsx`:**
```typescript
import React, { useState, useEffect } from 'react';
import { PlantSpecies, PlantPathwayCategory } from '../types';
import { plantPathwayService } from '../services/plantPathwayService';

interface PlantSpeciesSelectorProps {
  selectedSpecies: string;
  onSpeciesChange: (speciesId: string) => void;
}

export const PlantSpeciesSelector: React.FC<PlantSpeciesSelectorProps> = ({
  selectedSpecies,
  onSpeciesChange
}) => {
  const [plantSpecies, setPlantSpecies] = useState<{
    modelOrganisms: PlantSpecies[];
    cropSpecies: PlantSpecies[];
    treeSpecies: PlantSpecies[];
  }>({ modelOrganisms: [], cropSpecies: [], treeSpecies: [] });
  
  const [activeTab, setActiveTab] = useState<'model' | 'crop' | 'tree'>('model');
  
  useEffect(() => {
    const loadPlantSpecies = async () => {
      try {
        const species = await plantPathwayService.getPlantSpecies();
        setPlantSpecies(species);
      } catch (error) {
        console.error('Failed to load plant species:', error);
      }
    };
    
    loadPlantSpecies();
  }, []);
  
  const renderSpeciesList = (species: PlantSpecies[]) => (
    <div className="space-y-2">
      {species.map(s => (
        <div
          key={s.id}
          className={`p-3 rounded cursor-pointer transition-colors ${
            selectedSpecies === s.id 
              ? 'bg-cyan-600 text-white' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          onClick={() => onSpeciesChange(s.id)}
        >
          <div className="font-medium">{s.commonName}</div>
          <div className="text-sm opacity-75">{s.scientificName}</div>
          <div className="text-xs mt-1 flex items-center space-x-2">
            <span className={`px-2 py-1 rounded text-xs ${
              s.tier === 'Tier1' ? 'bg-yellow-600' :
              s.tier === 'Tier2' ? 'bg-blue-600' : 'bg-gray-600'
            }`}>
              {s.tier}
            </span>
            <span>{s.pathwayCount} pathways</span>
          </div>
        </div>
      ))}
    </div>
  );
  
  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button
          className={`px-3 py-2 rounded text-sm ${
            activeTab === 'model' ? 'bg-cyan-600 text-white' : 'bg-gray-700'
          }`}
          onClick={() => setActiveTab('model')}
        >
          Model Organisms
        </button>
        <button
          className={`px-3 py-2 rounded text-sm ${
            activeTab === 'crop' ? 'bg-cyan-600 text-white' : 'bg-gray-700'
          }`}
          onClick={() => setActiveTab('crop')}
        >
          Crop Species
        </button>
        <button
          className={`px-3 py-2 rounded text-sm ${
            activeTab === 'tree' ? 'bg-cyan-600 text-white' : 'bg-gray-700'
          }`}
          onClick={() => setActiveTab('tree')}
        >
          Tree Species
        </button>
      </div>
      
      {activeTab === 'model' && renderSpeciesList(plantSpecies.modelOrganisms)}
      {activeTab === 'crop' && renderSpeciesList(plantSpecies.cropSpecies)}
      {activeTab === 'tree' && renderSpeciesList(plantSpecies.treeSpecies)}
    </div>
  );
};
```

### 2.2 Update Main App Component

**File: `App.tsx` - Add plant pathway support:**
```typescript
// Add to imports
import { PlantSpeciesSelector } from './components/PlantSpeciesSelector';
import { plantPathwayService } from './services/plantPathwayService';

// Update config state to include plant-specific options
const [config, setConfig] = useState<VisualizationConfig>({
  // ... existing config
  pathwayDatabase: 'MetaCyc', // Default to MetaCyc for plants
  speciesId: 'aracyc', // Default to Arabidopsis
  // Add plant-specific visualization options
  showPlantCompartments: true,
  highlightPlantSpecificEnzymes: true,
  plantColorScheme: 'Plant'
});

// Add plant pathway state
const [plantPathways, setPlantPathways] = useState<{
  byCategory: Record<PlantPathwayCategory, PlantPathway[]>;
  featured: PlantPathway[];
}>({ byCategory: {}, featured: [] });

// Update handleGenerate to use plant pathway service when appropriate
const handleGenerate = useCallback(async () => {
  // ... existing validation
  
  try {
    // Use plant pathway service for MetaCyc plant species
    if (config.pathwayDatabase === 'MetaCyc' && isPlantSpecies(config.speciesId)) {
      const pathwayData = await plantPathwayService.getPlantPathways(config.speciesId);
      setPlantPathways(pathwayData);
    }
    
    // ... rest of generation logic
  } catch (err) {
    // ... error handling
  }
}, [geneData, compoundData, config, customSbgnFile]);
```

## Phase 3: Enhanced Pathway Browsing

### 3.1 Plant Pathway Browser Component

**File: `components/PlantPathwayBrowser.tsx`:**
```typescript
import React, { useState } from 'react';
import { PlantPathway, PlantPathwayCategory } from '../types';

interface PlantPathwayBrowserProps {
  pathways: Record<PlantPathwayCategory, PlantPathway[]>;
  featured: PlantPathway[];
  selectedPathway: string;
  onPathwaySelect: (pathwayId: string) => void;
}

export const PlantPathwayBrowser: React.FC<PlantPathwayBrowserProps> = ({
  pathways,
  featured,
  selectedPathway,
  onPathwaySelect
}) => {
  const [activeCategory, setActiveCategory] = useState<PlantPathwayCategory | 'featured'>('featured');
  
  const categories = Object.keys(pathways) as PlantPathwayCategory[];
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          className={`px-3 py-2 rounded text-sm ${
            activeCategory === 'featured' ? 'bg-cyan-600 text-white' : 'bg-gray-700'
          }`}
          onClick={() => setActiveCategory('featured')}
        >
          Featured
        </button>
        {categories.map(category => (
          <button
            key={category}
            className={`px-3 py-2 rounded text-sm ${
              activeCategory === category ? 'bg-cyan-600 text-white' : 'bg-gray-700'
            }`}
            onClick={() => setActiveCategory(category)}
          >
            {category} ({pathways[category]?.length || 0})
          </button>
        ))}
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activeCategory === 'featured' && featured.map(pathway => (
          <PathwayItem
            key={pathway.id}
            pathway={pathway}
            isSelected={selectedPathway === pathway.id}
            onSelect={() => onPathwaySelect(pathway.id)}
          />
        ))}
        
        {activeCategory !== 'featured' && pathways[activeCategory]?.map(pathway => (
          <PathwayItem
            key={pathway.id}
            pathway={pathway}
            isSelected={selectedPathway === pathway.id}
            onSelect={() => onPathwaySelect(pathway.id)}
          />
        ))}
      </div>
    </div>
  );
};

const PathwayItem: React.FC<{
  pathway: PlantPathway;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ pathway, isSelected, onSelect }) => (
  <div
    className={`p-3 rounded cursor-pointer transition-colors ${
      isSelected ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
    }`}
    onClick={onSelect}
  >
    <div className="font-medium">{pathway.displayName}</div>
    <div className="text-sm opacity-75 flex items-center space-x-2 mt-1">
      <span className={`px-2 py-1 rounded text-xs ${
        pathway.isPlantSpecific ? 'bg-green-600' : 'bg-blue-600'
      }`}>
        {pathway.isPlantSpecific ? 'Plant-specific' : 'Universal'}
      </span>
      <span className={`px-2 py-1 rounded text-xs ${
        pathway.evidenceLevel === 'Experimental' ? 'bg-yellow-600' :
        pathway.evidenceLevel === 'Computational' ? 'bg-purple-600' : 'bg-gray-600'
      }`}>
        {pathway.evidenceLevel}
      </span>
    </div>
  </div>
);
```

## Phase 4: Testing and Validation

### 4.1 Test Data for Arabidopsis
Create test datasets for common Arabidopsis pathways:
- Calvin-Benson-Bassham cycle genes
- Flavonoid biosynthesis genes
- Auxin biosynthesis genes

### 4.2 Integration Testing
- Test species loading for all plant categories
- Validate pathway categorization
- Ensure proper error handling for API failures

## Implementation Timeline

- **Week 1**: Implement enhanced plant pathway service and types
- **Week 2**: Create plant-specific UI components
- **Week 3**: Integrate with existing app and test Arabidopsis pathways
- **Week 4**: Add other plant species and pathway categories
- **Week 5**: Testing, refinement, and documentation

## Expected Outcomes

1. **Arabidopsis as Featured Species**: Prominent placement with 311+ curated pathways
2. **Plant Pathway Categories**: Organized browsing by biological function
3. **Quality Indicators**: Clear distinction between experimental and computational data
4. **Enhanced User Experience**: Plant-focused navigation and discovery
5. **Scalable Architecture**: Easy addition of new plant species and pathways

This integration plan transforms the current basic MetaCyc support into a comprehensive plant pathway visualization platform, with Arabidopsis thaliana as the flagship species and broad plant biology research support.