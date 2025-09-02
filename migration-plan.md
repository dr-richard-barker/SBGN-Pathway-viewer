# Migration Plan: AI to R/Python Backend

## Configuration Changes Required

### 1. Environment Variables
**Current (AI-based):**
```
GEMINI_API_KEY=your_gemini_key
```

**New (Backend service):**
```
BACKEND_SERVICE_URL=http://localhost:8000
# Optional: API keys for pathway databases
REACTOME_API_KEY=optional
KEGG_API_KEY=optional
```

### 2. Vite Configuration Updates
**File: `vite.config.ts`**
```typescript
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.BACKEND_SERVICE_URL': JSON.stringify(env.BACKEND_SERVICE_URL || 'http://localhost:8000'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Add proxy for development
      server: {
        proxy: {
          '/api': {
            target: env.BACKEND_SERVICE_URL || 'http://localhost:8000',
            changeOrigin: true,
          }
        }
      }
    };
});
```

### 3. Package.json Updates
**Remove AI dependencies:**
```json
{
  "dependencies": {
    // Remove: "@google/genai": "^1.15.0",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  }
}
```

**Add HTTP client:**
```json
{
  "dependencies": {
    "axios": "^1.6.0", // or fetch API (built-in)
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  }
}
```

### 4. Service Layer Replacement

**New file: `services/backendService.ts`**
```typescript
import { type VisualizationConfig } from '../types';

const BACKEND_URL = process.env.BACKEND_SERVICE_URL || 'http://localhost:8000';

export interface PathwayGenerationRequest {
  geneData: string;
  compoundData: string | null;
  config: VisualizationConfig;
  customSbgnFile: string | null;
}

export async function generatePathwaySvg(
  geneData: string, 
  compoundData: string | null, 
  config: VisualizationConfig, 
  customSbgnFile: string | null
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/generate-pathway`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      geneData,
      compoundData,
      config,
      customSbgnFile
    } as PathwayGenerationRequest)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate pathway visualization');
  }

  const result = await response.json();
  return result.svg;
}

export async function getPathways(database: string, speciesId: string) {
  const response = await fetch(`${BACKEND_URL}/api/pathways/${database}/${speciesId}`);
  if (!response.ok) throw new Error('Failed to fetch pathways');
  return response.json();
}

export async function getSpecies(database: string) {
  const response = await fetch(`${BACKEND_URL}/api/species/${database}`);
  if (!response.ok) throw new Error('Failed to fetch species');
  return response.json();
}
```

### 5. App.tsx Updates
**Replace import:**
```typescript
// Old: import { generatePathwaySvg } from './services/geminiService';
import { generatePathwaySvg } from './services/backendService';
```

**Update error handling:**
```typescript
} catch (err) {
  console.error(err);
  // Enhanced error handling for backend service
  if (err instanceof Error) {
    if (err.message.includes('fetch')) {
      setError('Backend service unavailable. Please ensure the R/Python service is running.');
    } else {
      setError(err.message);
    }
  } else {
    setError('An unknown error occurred.');
  }
}
```

### 6. Enhanced Configuration Types
**File: `types.ts` - Add backend-specific types:**
```typescript
export interface BackendError {
  message: string;
  code: string;
  details?: any;
}

export interface PathwayGenerationResponse {
  svg: string;
  metadata?: {
    pathwayName: string;
    geneCount: number;
    compoundCount: number;
    processingTime: number;
  };
}

// Enhanced config with backend-specific options
export interface VisualizationConfig {
  // ... existing fields
  
  // New backend-specific options
  renderingEngine?: 'SBGNview' | 'pathview';
  cacheResults?: boolean;
  highResolution?: boolean;
}
```

### 7. Development Workflow Changes

**New npm scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "dev:full": "concurrently \"npm run backend:dev\" \"npm run dev\"",
    "backend:dev": "cd backend && docker-compose up -d",
    "backend:stop": "cd backend && docker-compose down",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Migration Steps

1. **Setup Backend Service** (Choose R or Python)
2. **Update Frontend Configuration** (vite.config.ts, package.json)
3. **Replace Service Layer** (geminiService.ts → backendService.ts)
4. **Update App.tsx** (import and error handling)
5. **Test Integration** (ensure data flow works)
6. **Enhanced Features** (caching, better error handling)
7. **Documentation Update** (README.md, setup instructions)

## Benefits of Migration

- **Reliability**: No AI API rate limits or availability issues
- **Accuracy**: Uses established bioinformatics libraries (SBGNview)
- **Performance**: Local processing, no network latency for generation
- **Cost**: No API usage costs
- **Customization**: Full control over visualization algorithms
- **Offline Capability**: Works without internet connection