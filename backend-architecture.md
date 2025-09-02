# Backend Service Architecture for SBGN Pathway Visualization

## Overview
Replace Gemini AI with dedicated R/Python services that use established bioinformatics libraries for proper SBGN pathway generation.

## Proposed Architecture

### Option 1: R-based Service (Recommended)
```
Frontend (React/TS) → REST API → R Service → SVG Output
```

**R Libraries:**
- `SBGNview`: Core SBGN pathway visualization (exact functionality we're replicating)
- `pathview`: Alternative pathway visualization
- `ReactomePA`: Reactome pathway analysis
- `KEGGREST`: KEGG database access
- `plumber`: REST API framework for R

**Service Structure:**
```
backend/
├── r-service/
│   ├── api.R              # Plumber REST API endpoints
│   ├── pathway-service.R  # Core pathway generation logic
│   ├── data-processor.R   # Gene/compound data processing
│   ├── sbgn-generator.R   # SBGN-specific SVG generation
│   └── database-clients/  # Database-specific API clients
│       ├── reactome.R
│       ├── kegg.R
│       └── metacyc.R
├── Dockerfile
└── requirements.R
```

### Option 2: Python-based Service
```
Frontend (React/TS) → REST API → Python Service → SVG Output
```

**Python Libraries:**
- `libsbgn-python`: SBGN format handling
- `networkx`: Graph manipulation
- `matplotlib/plotly`: SVG generation
- `biopython`: Bioinformatics utilities
- `fastapi`: REST API framework
- `pandas`: Data processing

**Service Structure:**
```
backend/
├── python-service/
│   ├── main.py           # FastAPI application
│   ├── pathway_service.py # Core pathway generation
│   ├── data_processor.py  # Gene/compound data processing
│   ├── sbgn_generator.py  # SBGN SVG generation
│   └── database_clients/ # Database API clients
│       ├── reactome.py
│       ├── kegg.py
│       └── metacyc.py
├── Dockerfile
└── requirements.txt
```

## New Data Flow
```
Gene Data → Configuration → Backend Service → SBGN Processing → SVG Output
```

### API Endpoints
```
POST /api/generate-pathway
{
  "geneData": "csv_string",
  "compoundData": "csv_string",
  "config": VisualizationConfig,
  "customSbgnFile": "xml_string"
}

GET /api/pathways/{database}/{species}
GET /api/species/{database}
```

## Implementation Plan

### Phase 1: R Service Setup
1. Create R service with SBGNview integration
2. Implement REST API with plumber
3. Add pathway database clients
4. Docker containerization

### Phase 2: Frontend Integration
1. Replace geminiService.ts with backendService.ts
2. Update API calls to use new endpoints
3. Handle new error responses
4. Update configuration flow

### Phase 3: Enhanced Features
1. Caching for pathway data
2. Batch processing capabilities
3. Advanced SBGN customization
4. Performance optimization