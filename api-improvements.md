# API Integration Improvements Plan

## Current Issues with Pathway Database APIs

### 1. CORS and Security Issues
- **KEGG & PANTHER**: HTTP-only APIs causing mixed-content errors
- **SMPDB & MetaCyc**: Missing CORS headers
- **Current workaround**: Using CORS proxy (corsproxy.io) - unreliable

### 2. Authentication Patterns
- **Reactome**: No authentication required
- **KEGG**: No authentication, but rate-limited
- **PANTHER**: No authentication
- **SMPDB**: Requires registration for full access
- **MetaCyc**: API key required for advanced features

### 3. API Response Inconsistencies
- Different data formats (JSON, TSV, XML)
- Inconsistent error handling
- Varying rate limits and timeouts

## Proposed Improvements

### Backend Service API Integration

**Centralized Database Client Architecture:**
```
Backend Service
├── database_clients/
│   ├── base_client.py/R     # Abstract base with common functionality
│   ├── reactome_client.py/R # Reactome-specific implementation
│   ├── kegg_client.py/R     # KEGG-specific implementation
│   ├── panther_client.py/R  # PANTHER-specific implementation
│   ├── smpdb_client.py/R    # SMPDB-specific implementation
│   └── metacyc_client.py/R  # MetaCyc-specific implementation
```

### 1. Enhanced Authentication System

**Environment Configuration:**
```bash
# Optional API keys for enhanced access
REACTOME_API_KEY=optional
KEGG_API_KEY=optional
PANTHER_API_KEY=optional
SMPDB_API_KEY=required_for_full_access
METACYC_API_KEY=required_for_advanced_features

# Rate limiting configuration
API_RATE_LIMIT_PER_MINUTE=60
API_TIMEOUT_SECONDS=30
```

**Authentication Handler (Python example):**
```python
class DatabaseAuthenticator:
    def __init__(self):
        self.api_keys = {
            'reactome': os.getenv('REACTOME_API_KEY'),
            'kegg': os.getenv('KEGG_API_KEY'),
            'panther': os.getenv('PANTHER_API_KEY'),
            'smpdb': os.getenv('SMPDB_API_KEY'),
            'metacyc': os.getenv('METACYC_API_KEY'),
        }
    
    def get_headers(self, database: str) -> dict:
        headers = {'User-Agent': 'SBGN-Pathway-Viewer/1.0'}
        if api_key := self.api_keys.get(database):
            if database == 'smpdb':
                headers['Authorization'] = f'Bearer {api_key}'
            elif database == 'metacyc':
                headers['X-API-Key'] = api_key
        return headers
```

### 2. Unified Response Format

**Standardized API Response:**
```typescript
interface DatabaseResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    database: string;
    timestamp: string;
    cached: boolean;
    rateLimit?: {
      remaining: number;
      resetTime: string;
    };
  };
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
}
```

### 3. Robust Error Handling & Retry Logic

**Error Categories:**
```python
class DatabaseError(Exception):
    pass

class RateLimitError(DatabaseError):
    def __init__(self, retry_after: int):
        self.retry_after = retry_after

class AuthenticationError(DatabaseError):
    pass

class NetworkError(DatabaseError):
    pass

class DataFormatError(DatabaseError):
    pass
```

**Retry Strategy:**
```python
async def fetch_with_retry(
    url: str, 
    headers: dict, 
    max_retries: int = 3,
    backoff_factor: float = 1.0
) -> dict:
    for attempt in range(max_retries):
        try:
            response = await httpx.get(url, headers=headers, timeout=30)
            if response.status_code == 429:  # Rate limited
                retry_after = int(response.headers.get('Retry-After', 60))
                raise RateLimitError(retry_after)
            response.raise_for_status()
            return response.json()
        except RateLimitError:
            if attempt < max_retries - 1:
                await asyncio.sleep(backoff_factor * (2 ** attempt))
            else:
                raise
        except httpx.RequestError as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(backoff_factor * (2 ** attempt))
            else:
                raise NetworkError(f"Network error: {e}")
```

### 4. Caching Strategy

**Multi-level Caching:**
```python
class DatabaseCache:
    def __init__(self):
        self.memory_cache = {}  # In-memory for frequent requests
        self.redis_cache = redis.Redis()  # Persistent cache
    
    async def get_species(self, database: str) -> Optional[List[Species]]:
        # Check memory cache first
        cache_key = f"species:{database}"
        if cached := self.memory_cache.get(cache_key):
            return cached
        
        # Check Redis cache
        if cached := await self.redis_cache.get(cache_key):
            data = json.loads(cached)
            self.memory_cache[cache_key] = data  # Populate memory cache
            return data
        
        return None
    
    async def set_species(self, database: str, data: List[Species], ttl: int = 3600):
        cache_key = f"species:{database}"
        self.memory_cache[cache_key] = data
        await self.redis_cache.setex(cache_key, ttl, json.dumps(data))
```

### 5. Database-Specific Optimizations

**Reactome Client:**
```python
class ReactomeClient(BaseClient):
    BASE_URL = "https://reactome.org/ContentService"
    
    async def get_pathways(self, species_id: str) -> List[Pathway]:
        url = f"{self.BASE_URL}/data/pathways/top/{species_id}"
        response = await self.fetch_with_retry(url)
        return [
            Pathway(id=str(p['stId']), displayName=p['displayName'])
            for p in response if p.get('stId') and p.get('displayName')
        ]
```

**KEGG Client:**
```python
class KEGGClient(BaseClient):
    BASE_URL = "https://rest.kegg.jp"
    
    async def get_pathways(self, species_id: str) -> List[Pathway]:
        url = f"{self.BASE_URL}/list/pathway/{species_id}"
        response = await self.fetch_text_with_retry(url)
        pathways = []
        for line in response.strip().split('\n'):
            parts = line.split('\t')
            if len(parts) >= 2:
                pathway_id = parts[0].replace('path:', '')
                name = parts[1]
                pathways.append(Pathway(id=pathway_id, displayName=name))
        return pathways
```

### 6. API Rate Limiting & Monitoring

**Rate Limiter:**
```python
class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    
    async def acquire(self, database: str) -> bool:
        now = time.time()
        minute_ago = now - 60
        
        # Clean old requests
        self.requests[database] = [
            req_time for req_time in self.requests[database] 
            if req_time > minute_ago
        ]
        
        if len(self.requests[database]) >= self.requests_per_minute:
            return False
        
        self.requests[database].append(now)
        return True
```

### 7. Enhanced Frontend Integration

**Improved pathwayService.ts:**
```typescript
export class PathwayService {
  private baseUrl: string;
  private cache = new Map<string, any>();
  
  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }
  
  async getSpecies(database: PathwayDatabase): Promise<Species[]> {
    const cacheKey = `species:${database}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/species/${database}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch species: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.cache.set(cacheKey, result.data);
      return result.data;
    } catch (error) {
      console.error(`Error fetching species for ${database}:`, error);
      throw new Error(`Unable to load species data for ${database}`);
    }
  }
  
  async getPathways(database: PathwayDatabase, speciesId: string): Promise<Pathway[]> {
    const cacheKey = `pathways:${database}:${speciesId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/pathways/${database}/${speciesId}`);
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before making more requests.');
        }
        throw new Error(`Failed to fetch pathways: ${response.statusText}`);
      }
      
      const result = await response.json();
      this.cache.set(cacheKey, result.data);
      return result.data;
    } catch (error) {
      console.error(`Error fetching pathways for ${database}/${speciesId}:`, error);
      throw error;
    }
  }
}
```

## Implementation Priority

1. **High Priority**: Backend service with unified database clients
2. **High Priority**: Robust error handling and retry logic
3. **Medium Priority**: Caching system implementation
4. **Medium Priority**: Rate limiting and monitoring
5. **Low Priority**: Advanced authentication features
6. **Low Priority**: Performance monitoring and analytics

## Benefits

- **Reliability**: No CORS issues, proper error handling
- **Performance**: Caching reduces API calls
- **Scalability**: Rate limiting prevents API abuse
- **Maintainability**: Unified interface for all databases
- **Security**: Proper API key management
- **User Experience**: Better error messages and loading states