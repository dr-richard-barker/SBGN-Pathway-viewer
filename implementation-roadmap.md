# Implementation Roadmap: AI to R/Python Migration

## Phase 1: Backend Service Foundation (Week 1-2)

### 1.1 Choose Technology Stack
**Recommendation: R with SBGNview**
- Mature bioinformatics ecosystem
- Direct SBGNview library access (exact functionality needed)
- Established pathway analysis tools

**Alternative: Python with custom SBGN**
- More flexible for custom implementations
- Better web service ecosystem
- Requires building SBGN generation from scratch

### 1.2 Setup R Service Infrastructure
```bash
# Create backend directory structure
mkdir -p backend/r-service
cd backend/r-service

# Initialize R project
touch api.R pathway-service.R data-processor.R
mkdir database-clients
```

**File: `backend/r-service/requirements.R`**
```r
# Core packages
install.packages(c(
  "plumber",        # REST API framework
  "SBGNview",       # SBGN pathway visualization
  "pathview",       # Alternative pathway visualization
  "ReactomePA",     # Reactome pathway analysis
  "KEGGREST",       # KEGG database access
  "jsonlite",       # JSON handling
  "httr",           # HTTP requests
  "dplyr",          # Data manipulation
  "readr",          # CSV reading
  "stringr"         # String manipulation
))

# Bioconductor packages
if (!require("BiocManager", quietly = TRUE))
    install.packages("BiocManager")
BiocManager::install(c("SBGNview", "pathview", "ReactomePA", "KEGGREST"))
```

### 1.3 Core API Structure
**File: `backend/r-service/api.R`**
```r
library(plumber)
library(jsonlite)
source("pathway-service.R")
source("data-processor.R")

#* @apiTitle SBGN Pathway Visualization API
#* @apiDescription API for generating SBGN pathway visualizations

#* Generate pathway SVG
#* @param geneData:character Gene expression data (CSV string)
#* @param compoundData:character Compound data (CSV string, optional)
#* @param config:list Visualization configuration
#* @param customSbgnFile:character Custom SBGN file (XML string, optional)
#* @post /generate-pathway
function(req) {
  tryCatch({
    body <- jsonlite::fromJSON(req$postBody)
    
    # Validate required fields
    if (is.null(body$geneData) || is.null(body$config)) {
      return(list(error = list(message = "Missing required fields", code = "VALIDATION_ERROR")))
    }
    
    # Process data and generate SVG
    svg_result <- generate_pathway_svg(
      gene_data = body$geneData,
      compound_data = body$compoundData,
      config = body$config,
      custom_sbgn = body$customSbgnFile
    )
    
    return(list(
      success = TRUE,
      svg = svg_result$svg,
      metadata = svg_result$metadata
    ))
    
  }, error = function(e) {
    return(list(
      success = FALSE,
      error = list(
        message = e$message,
        code = "GENERATION_ERROR"
      )
    ))
  })
}

#* Get species for database
#* @param database:character Database name
#* @get /species/<database>
function(database) {
  get_species_for_database(database)
}

#* Get pathways for database and species
#* @param database:character Database name
#* @param speciesId:character Species identifier
#* @get /pathways/<database>/<speciesId>
function(database, speciesId) {
  get_pathways_for_species(database, speciesId)
}
```

## Phase 2: Core Pathway Generation (Week 2-3)

### 2.1 Data Processing Service
**File: `backend/r-service/data-processor.R`**
```r
library(readr)
library(dplyr)

process_gene_data <- function(csv_string, data_type) {
  # Parse CSV string to data frame
  data <- read_csv(csv_string, show_col_types = FALSE)
  
  # Validate data format
  if (ncol(data) < 2) {
    stop("Gene data must have at least 2 columns (ID and value)")
  }
  
  # Process based on data type
  if (data_type == "deseq2") {
    # Expect log2FoldChange and padj columns
    processed <- data %>%
      filter(!is.na(log2FoldChange), !is.na(padj)) %>%
      filter(padj < 0.05) %>%
      arrange(padj)
  } else if (data_type == "norm_counts") {
    # Expect normalized count values
    processed <- data %>%
      filter(!is.na(!!sym(names(data)[2]))) %>%
      arrange(desc(!!sym(names(data)[2])))
  }
  
  return(processed)
}

summarize_data <- function(csv_string, data_type, max_entries = 100) {
  processed <- process_gene_data(csv_string, data_type)
  
  # Return top entries for visualization
  head(processed, max_entries)
}
```

### 2.2 SBGN Generation Service
**File: `backend/r-service/pathway-service.R`**
```r
library(SBGNview)
library(pathview)

generate_pathway_svg <- function(gene_data, compound_data = NULL, config, custom_sbgn = NULL) {
  start_time <- Sys.time()
  
  # Process input data
  gene_df <- process_gene_data(gene_data, config$dataType)
  compound_df <- if (!is.null(compound_data)) {
    process_gene_data(compound_data, config$compoundDataType)
  } else NULL
  
  # Generate pathway visualization
  if (!is.null(custom_sbgn)) {
    # Use custom SBGN file
    svg_result <- generate_from_custom_sbgn(gene_df, compound_df, config, custom_sbgn)
  } else {
    # Use database pathway
    svg_result <- generate_from_database(gene_df, compound_df, config)
  }
  
  end_time <- Sys.time()
  
  return(list(
    svg = svg_result,
    metadata = list(
      pathwayName = config$pathwayId,
      geneCount = nrow(gene_df),
      compoundCount = if (!is.null(compound_df)) nrow(compound_df) else 0,
      processingTime = as.numeric(difftime(end_time, start_time, units = "secs"))
    )
  ))
}

generate_from_database <- function(gene_df, compound_df, config) {
  # Map database names to SBGNview parameters
  db_mapping <- list(
    "Reactome" = "reactome",
    "KEGG" = "kegg",
    "PANTHER" = "panther"
  )
  
  if (!config$pathwayDatabase %in% names(db_mapping)) {
    stop(paste("Unsupported database:", config$pathwayDatabase))
  }
  
  # Prepare data for SBGNview
  gene_data_vector <- setNames(gene_df[[2]], gene_df[[1]])
  compound_data_vector <- if (!is.null(compound_df)) {
    setNames(compound_df[[2]], compound_df[[1]])
  } else NULL
  
  # Generate SBGN visualization
  sbgn_result <- SBGNview(
    gene.data = gene_data_vector,
    cpd.data = compound_data_vector,
    pathway.id = config$pathwayId,
    species = config$speciesId,
    output.file = tempfile(fileext = ".svg"),
    output.formats = "svg"
  )
  
  # Read generated SVG
  svg_content <- readLines(sbgn_result$output.file)
  svg_string <- paste(svg_content, collapse = "\n")
  
  # Clean up temporary file
  unlink(sbgn_result$output.file)
  
  return(svg_string)
}
```

## Phase 3: Frontend Integration (Week 3-4)

### 3.1 Remove AI Dependencies
```bash
# Remove Gemini package
npm uninstall @google/genai

# Add HTTP client if needed
npm install axios
```

### 3.2 Update Service Layer
**Replace `services/geminiService.ts` with `services/backendService.ts`:**
```typescript
export async function generatePathwaySvg(
  geneData: string,
  compoundData: string | null,
  config: VisualizationConfig,
  customSbgnFile: string | null
): Promise<string> {
  const response = await fetch('/api/generate-pathway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      geneData,
      compoundData,
      config,
      customSbgnFile
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate pathway');
  }

  const result = await response.json();
  return result.svg;
}
```

### 3.3 Update App.tsx
```typescript
// Replace import
import { generatePathwaySvg } from './services/backendService';

// Enhanced error handling in handleGenerate
} catch (err) {
  console.error(err);
  if (err instanceof Error) {
    if (err.message.includes('fetch') || err.message.includes('NetworkError')) {
      setError('Backend service unavailable. Please ensure the R service is running on port 8000.');
    } else {
      setError(err.message);
    }
  } else {
    setError('An unknown error occurred during pathway generation.');
  }
}
```

## Phase 4: Enhanced Features (Week 4-5)

### 4.1 Docker Containerization
**File: `backend/Dockerfile`**
```dockerfile
FROM rocker/r-ver:4.3.0

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
COPY requirements.R /tmp/
RUN Rscript /tmp/requirements.R

# Copy application code
WORKDIR /app
COPY . .

# Expose port
EXPOSE 8000

# Start API server
CMD ["Rscript", "-e", "plumber::plumb('api.R')$run(host='0.0.0.0', port=8000)"]
```

### 4.2 Development Environment
**File: `backend/docker-compose.yml`**
```yaml
version: '3.8'
services:
  r-service:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REACTOME_API_KEY=${REACTOME_API_KEY}
      - KEGG_API_KEY=${KEGG_API_KEY}
    volumes:
      - ./cache:/app/cache
    restart: unless-stopped
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## Phase 5: Testing & Validation (Week 5-6)

### 5.1 Integration Testing
```bash
# Test backend service
curl -X POST http://localhost:8000/api/generate-pathway \
  -H "Content-Type: application/json" \
  -d @test-data.json

# Test frontend integration
npm run dev:full  # Starts both frontend and backend
```

### 5.2 Performance Benchmarking
- Compare generation times: AI vs R service
- Memory usage analysis
- API response time monitoring
- Error rate tracking

## Phase 6: Documentation & Deployment (Week 6)

### 6.1 Update Documentation
- README.md with new setup instructions
- API documentation
- Developer guide updates
- Migration guide for existing users

### 6.2 Production Deployment
- Environment-specific configurations
- Health check endpoints
- Monitoring and logging
- Backup and recovery procedures

## Success Metrics

- **Functionality**: All current features work without AI dependency
- **Performance**: SVG generation time < 10 seconds
- **Reliability**: 99%+ uptime for backend service
- **Accuracy**: Generated SVGs match SBGNview R library output
- **Developer Experience**: Clear setup process, good error messages

## Risk Mitigation

- **R Package Dependencies**: Pin specific versions, use Docker
- **API Rate Limits**: Implement caching and rate limiting
- **Service Availability**: Health checks and auto-restart
- **Data Validation**: Comprehensive input validation
- **Backward Compatibility**: Maintain existing frontend interface

## Next Steps

1. **Decision**: Choose R or Python for backend implementation
2. **Setup**: Create backend service structure
3. **Core Implementation**: Build pathway generation service
4. **Integration**: Connect frontend to new backend
5. **Testing**: Validate functionality and performance
6. **Documentation**: Update all documentation
7. **Deployment**: Production-ready configuration