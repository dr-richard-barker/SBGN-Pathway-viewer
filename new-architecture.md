# New Architecture: R/Python Backend Integration

## System Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Backend        │    │   External APIs     │
│   (React/TS)    │◄──►│   (R/Python)     │◄──►│   (Pathway DBs)     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
│                      │                      │
│ • Data Upload        │ • SBGN Generation    │ • Reactome
│ • Configuration      │ • Data Processing    │ • KEGG  
│ • SVG Display        │ • Database Clients   │ • PANTHER
│ • User Interaction   │ • Caching Layer      │ • SMPDB
                       │ • Error Handling     │ • MetaCyc
```

## Data Flow Architecture

### Current (AI-based) Flow:
```
Gene Data → Summarization → AI Prompt → Gemini API → SVG String → Display
```

### New (R/Python-based) Flow:
```
Gene Data → Backend API → Data Processing → SBGN Library → SVG Generation → Response → Display
```

## Integration Points

### 1. Frontend ↔ Backend Communication

**API Contract:**
```typescript
// Request format
interface PathwayGenerationRequest {
  geneData: string;           // CSV format
  compoundData?: string;      // CSV format (optional)
  config: VisualizationConfig;
  customSbgnFile?: string;    // SBGN-ML XML (optional)
}

// Response format
interface PathwayGenerationResponse {
  success: boolean;
  svg?: string;
  metadata?: {
    pathwayName: string;
    geneCount: number;
    compoundCount: number;
    processingTime: number;
    cacheHit: boolean;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 2. Backend Service Architecture

#### R Service Implementation
```r
# Main pathway generation function
generate_pathway_svg <- function(gene_data, compound_data, config, custom_sbgn) {
  
  # 1. Data Processing
  gene_df <- parse_csv_data(gene_data)
  compound_df <- if (!is.null(compound_data)) parse_csv_data(compound_data) else NULL
  
  # 2. Pathway Retrieval
  if (!is.null(custom_sbgn)) {
    pathway_data <- parse_custom_sbgn(custom_sbgn)
  } else {
    pathway_data <- fetch_pathway_data(config$pathwayDatabase, config$pathwayId, config$speciesId)
  }
  
  # 3. Data Mapping
  mapped_data <- map_data_to_pathway(gene_df, compound_df, pathway_data, config)
  
  # 4. SVG Generation
  svg_output <- generate_sbgn_svg(mapped_data, config)
  
  return(svg_output)
}
```

#### Python Service Implementation
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
from typing import Optional

app = FastAPI(title="SBGN Pathway Visualization API")

class PathwayRequest(BaseModel):
    geneData: str
    compoundData: Optional[str] = None
    config: dict
    customSbgnFile: Optional[str] = None

@app.post("/api/generate-pathway")
async def generate_pathway(request: PathwayRequest):
    try:
        # 1. Process data
        gene_df = process_csv_data(request.geneData)
        compound_df = process_csv_data(request.compoundData) if request.compoundData else None
        
        # 2. Generate SBGN
        svg_result = await generate_sbgn_visualization(
            gene_df, compound_df, request.config, request.customSbgnFile
        )
        
        return {
            "success": True,
            "svg": svg_result.svg,
            "metadata": svg_result.metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 3. Database Client Integration

**Unified Database Interface:**
```r
# R implementation
get_pathway_data <- function(database, pathway_id, species_id) {
  client <- switch(database,
    "Reactome" = ReactomeClient$new(),
    "KEGG" = KEGGClient$new(),
    "PANTHER" = PANTHERClient$new(),
    stop(paste("Unsupported database:", database))
  )
  
  return(client$get_pathway(pathway_id, species_id))
}

# Base client class
DatabaseClient <- R6Class("DatabaseClient",
  public = list(
    base_url = NULL,
    api_key = NULL,
    
    initialize = function(base_url, api_key = NULL) {
      self$base_url <- base_url
      self$api_key <- api_key
    },
    
    get_species = function() {
      stop("Must implement get_species method")
    },
    
    get_pathways = function(species_id) {
      stop("Must implement get_pathways method")
    },
    
    get_pathway = function(pathway_id, species_id) {
      stop("Must implement get_pathway method")
    }
  )
)
```

### 4. Caching Strategy

**Multi-level Caching:**
```r
# Memory cache for session data
session_cache <- new.env()

# File-based cache for pathway data
cache_pathway_data <- function(key, data, ttl_hours = 24) {
  cache_dir <- "cache"
  if (!dir.exists(cache_dir)) dir.create(cache_dir)
  
  cache_file <- file.path(cache_dir, paste0(key, ".rds"))
  cache_data <- list(
    data = data,
    timestamp = Sys.time(),
    ttl_hours = ttl_hours
  )
  
  saveRDS(cache_data, cache_file)
}

get_cached_pathway_data <- function(key) {
  cache_file <- file.path("cache", paste0(key, ".rds"))
  
  if (!file.exists(cache_file)) return(NULL)
  
  cache_data <- readRDS(cache_file)
  
  # Check if cache is expired
  if (difftime(Sys.time(), cache_data$timestamp, units = "hours") > cache_data$ttl_hours) {
    unlink(cache_file)
    return(NULL)
  }
  
  return(cache_data$data)
}
```

### 5. Error Handling & Logging

**Structured Error Handling:**
```r
# Custom error classes
PathwayError <- function(message, code = "PATHWAY_ERROR") {
  structure(
    list(message = message, code = code),
    class = c("PathwayError", "error", "condition")
  )
}

DataProcessingError <- function(message) {
  PathwayError(message, "DATA_PROCESSING_ERROR")
}

DatabaseError <- function(message) {
  PathwayError(message, "DATABASE_ERROR")
}

# Error handler middleware
handle_errors <- function(expr) {
  tryCatch(expr, 
    PathwayError = function(e) {
      list(
        success = FALSE,
        error = list(
          code = e$code,
          message = e$message
        )
      )
    },
    error = function(e) {
      # Log unexpected errors
      cat("Unexpected error:", e$message, "\n")
      list(
        success = FALSE,
        error = list(
          code = "INTERNAL_ERROR",
          message = "An unexpected error occurred"
        )
      )
    }
  )
}
```

### 6. Configuration Management

**Backend Configuration:**
```r
# config.R
get_config <- function() {
  list(
    api = list(
      host = Sys.getenv("API_HOST", "0.0.0.0"),
      port = as.integer(Sys.getenv("API_PORT", "8000")),
      cors_origins = strsplit(Sys.getenv("CORS_ORIGINS", "*"), ",")[[1]]
    ),
    database = list(
      reactome_api_key = Sys.getenv("REACTOME_API_KEY"),
      kegg_api_key = Sys.getenv("KEGG_API_KEY"),
      rate_limit_per_minute = as.integer(Sys.getenv("RATE_LIMIT", "60"))
    ),
    cache = list(
      enabled = Sys.getenv("CACHE_ENABLED", "true") == "true",
      ttl_hours = as.integer(Sys.getenv("CACHE_TTL_HOURS", "24")),
      max_size_mb = as.integer(Sys.getenv("CACHE_MAX_SIZE_MB", "100"))
    )
  )
}
```

## Development Environment Setup

### 1. Backend Development
```bash
# R service
cd backend/r-service
Rscript requirements.R
Rscript -e "plumber::plumb('api.R')$run(host='0.0.0.0', port=8000)"

# Python service (alternative)
cd backend/python-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Development
```bash
# Update vite config for proxy
npm run dev  # Will proxy /api/* to backend service
```

### 3. Full Stack Development
```bash
# Using docker-compose
cd backend && docker-compose up -d
npm run dev

# Or using npm scripts
npm run dev:full
```

## Key Benefits of New Architecture

1. **Reliability**: No external AI API dependencies
2. **Accuracy**: Uses established bioinformatics libraries
3. **Performance**: Local processing, caching capabilities
4. **Cost**: No API usage fees
5. **Customization**: Full control over visualization algorithms
6. **Offline**: Works without internet connection
7. **Scalability**: Can handle multiple concurrent requests
8. **Maintainability**: Clear separation of concerns

## Migration Checklist

- [ ] Choose R or Python for backend implementation
- [ ] Setup backend service structure
- [ ] Implement core SBGN generation logic
- [ ] Create database client abstractions
- [ ] Add caching and error handling
- [ ] Update frontend service layer
- [ ] Remove AI dependencies from frontend
- [ ] Update configuration and environment setup
- [ ] Add Docker containerization
- [ ] Create comprehensive testing suite
- [ ] Update documentation
- [ ] Deploy and validate production setup

## Recommended Next Steps

1. **Start with R implementation** - SBGNview library provides exact functionality
2. **Create minimal viable backend** - Single endpoint for pathway generation
3. **Update frontend incrementally** - Replace AI service step by step
4. **Add enhanced features** - Caching, better error handling, monitoring
5. **Production deployment** - Docker, environment configuration, documentation