# Job Scraping Agent - File Index

Complete reference of all files in the Module 02 implementation.

## 📁 Directory Structure

```
src/agent/
├── index.ts                          # Main entry point
├── firebase-admin.ts                 # Firebase Admin SDK initialization
│
├── scrapers/                         # Platform-specific scrapers
│   ├── base-scraper.ts              # Abstract base class
│   ├── gupy-scraper.ts              # Gupy platform (Playwright)
│   └── indeed-br-scraper.ts         # Indeed Brazil (Axios + Cheerio)
│
├── utils/                           # Utility modules
│   ├── logger.ts                    # Winston logger configuration
│   ├── deduplication.ts            # Hash generation & blacklist
│   ├── config.ts                    # Configuration validator (Zod)
│   └── health.ts                    # Health check HTTP server
│
├── __tests__/                       # Unit tests
│   └── deduplication.test.ts       # Deduplication logic tests
│
├── examples/                        # Example/demo scripts
│   ├── run-single-scraper.ts       # Manual scraper execution
│   └── test-deduplication.ts       # Test dedup system
│
├── 📚 Documentation
│   ├── README.md                    # Main documentation
│   ├── QUICKSTART.md               # 5-minute setup guide
│   ├── DEPLOYMENT.md               # Production deployment
│   ├── MODULE_02_SCRAPING.md       # Implementation summary
│   ├── CHANGELOG.md                # Version history
│   └── INDEX.md                    # This file
│
└── 🐳 Deployment
    ├── Dockerfile                   # Multi-stage Docker build
    ├── .dockerignore               # Docker ignore patterns
    ├── fly.toml                    # Fly.io configuration
    └── .env.example                # Environment template
```

## 📄 Core Files

### index.ts
**Purpose**: Main container entry point  
**Responsibilities**:
- Load and validate configuration
- Initialize cron scheduler
- Orchestrate parallel scraper execution
- Start health check server
- Handle graceful shutdown
- Log runs to Firestore

**Key Functions**:
- `runScrapers()` - Execute all enabled scrapers
- `main()` - Initialize and start container
- `shutdown()` - Graceful cleanup

**Dependencies**: All other modules

---

### firebase-admin.ts
**Purpose**: Firebase Admin SDK initialization  
**Exports**:
- `adminDb` - Firestore instance
- `adminStorage` - Storage instance
- `adminAuth` - Auth instance

**Configuration**:
- `FIREBASE_SERVICE_ACCOUNT` env var (JSON)
- `FIREBASE_STORAGE_BUCKET` env var

**Error Handling**: Fails fast on initialization errors

---

## 🔧 Scrapers

### scrapers/base-scraper.ts
**Purpose**: Abstract base class for all scrapers  
**Type**: Abstract class

**Abstract Methods**:
- `scrape()` - Platform-specific implementation

**Concrete Methods**:
- `normalize()` - Convert RawJobInput → NormalizedJob
- `checkBlacklist()` - Query Firestore for duplicates
- `run()` - Orchestrate scrape → normalize → dedup

**Constructor**:
```typescript
constructor(config: ScraperConfig, logger: Logger)
```

**Used By**: GupyScraper, IndeedBRScraper

---

### scrapers/gupy-scraper.ts
**Purpose**: Scrape jobs from Gupy platform  
**Extends**: BaseScraper  
**Technology**: Playwright + Chromium

**Features**:
- Headless browser automation
- Stealth configuration (user agent, viewport)
- Pagination via "Load More" button
- Extracts: title, company, location, URL, description, salary, type
- Browser cleanup in finally block

**Limitations**:
- Requires ~200MB for Chromium
- Slower than static scraping
- Selector-dependent (may break on UI changes)

---

### scrapers/indeed-br-scraper.ts
**Purpose**: Scrape jobs from Indeed Brazil  
**Extends**: BaseScraper  
**Technology**: Axios + Cheerio

**Features**:
- Static HTML parsing (faster, less resource-intensive)
- Pagination with respectful delays (2s)
- Skill extraction from descriptions
- CSS selector-based extraction

**Search Parameters**:
- Query: "desenvolvedor" (developer)
- Location: Brasil
- Sort: by date
- Timeframe: Last 7 days

**Limitations**:
- Only works for static HTML (not dynamic content)
- Selector-dependent

---

## 🛠 Utils

### utils/logger.ts
**Purpose**: Winston logger configuration and factory  
**Exports**:
- `createLogger(module: string)` - Factory function
- `default` - Default logger instance

**Features**:
- Structured JSON logging
- Module-based child loggers
- Automatic sensitive data redaction
- Console (colorized in dev) + file rotation (production)
- Levels: error, warn, info, debug

**Sensitive Fields Redacted**:
- password, token, apiKey, secret, credential, authorization, cookie, session

**Log Format**:
```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "...",
  "module": "scraper:gupy",
  ...metadata
}
```

---

### utils/deduplication.ts
**Purpose**: Job deduplication logic  
**Exports**:
- `generateJobHash(externalId, platform)` - SHA256 hash
- `checkBlacklist(db, hash)` - Query Firestore
- `addToBlacklist(db, hash, jobData)` - Store hash

**Hash Algorithm**: SHA256  
**Hash Input**: `${externalId}::${platform}`  
**Firestore Collection**: `jobBlacklist/{hash}`

**Blacklist Document**:
```typescript
{
  hash: string
  externalId: string
  platform: string
  title: string
  company: string
  url: string
  createdAt: Timestamp
}
```

---

### utils/config.ts
**Purpose**: Configuration validation with Zod  
**Exports**:
- `AgentConfigSchema` - Zod schema
- `AgentConfig` - TypeScript type
- `loadConfig()` - Load and validate env vars

**Validated Fields**:
- firebaseServiceAccount (required)
- cronSchedule (default: '0 */6 * * *')
- scraperPlatforms (default: ['gupy', 'indeed-br'])
- maxJobsPerRun (default: 50)
- logLevel (default: 'info')
- And more...

**Error Handling**: Clear validation messages on failure

---

### utils/health.ts
**Purpose**: HTTP health check endpoint  
**Exports**:
- `HealthStatus` - Type definition
- `getHealthStatus()` - Async health check
- `startHealthServer(port)` - Start HTTP server

**Endpoint**: `/health`  
**Port**: 3001 (configurable)

**Health Checks**:
1. Firestore connectivity
2. Memory usage (< 80% threshold)

**Response**:
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "...",
  "uptime": 3600,
  "checks": {
    "firestore": true,
    "memory": true
  }
}
```

**Status Codes**:
- 200: healthy or degraded
- 503: unhealthy

---

## 🧪 Tests & Examples

### __tests__/deduplication.test.ts
**Purpose**: Unit tests for deduplication logic  
**Framework**: Jest (assumed)

**Tests**:
- Hash consistency (same input → same hash)
- Hash uniqueness (different input → different hash)
- Platform differentiation
- Special character handling

---

### examples/run-single-scraper.ts
**Purpose**: Manual scraper execution for testing  
**Usage**:
```bash
tsx src/agent/examples/run-single-scraper.ts gupy
tsx src/agent/examples/run-single-scraper.ts indeed-br
```

**Features**:
- Limited to 10 jobs for testing
- Displays results in console
- Exits with proper status codes

---

### examples/test-deduplication.ts
**Purpose**: Test deduplication system end-to-end  
**Usage**:
```bash
tsx src/agent/examples/test-deduplication.ts
```

**Tests**:
1. Hash generation
2. Blacklist check (before adding)
3. Add to blacklist
4. Blacklist check (after adding)
5. Cleanup test data

---

## 📚 Documentation

### README.md
**Audience**: Developers  
**Content**:
- Architecture overview
- Features list
- Environment variables
- Usage (dev/prod)
- How it works
- Adding new scrapers
- Firestore schema
- Troubleshooting

**Length**: ~500 lines

---

### QUICKSTART.md
**Audience**: New users  
**Content**:
- 5-minute setup guide
- Prerequisites
- Step-by-step instructions
- Common issues
- Success checklist

**Length**: ~200 lines

---

### DEPLOYMENT.md
**Audience**: DevOps/deployment  
**Content**:
- Railway deployment
- Fly.io deployment
- Generic Docker
- Environment variables
- Monitoring
- Scaling
- Troubleshooting
- Security
- Cost optimization
- Production checklist

**Length**: ~600 lines

---

### MODULE_02_SCRAPING.md
**Audience**: Project stakeholders  
**Content**:
- Implementation summary
- Files created
- Features implemented
- Data flow
- Firestore schema
- Success criteria

**Length**: ~400 lines

---

### CHANGELOG.md
**Audience**: All users  
**Content**:
- Version history
- Features added
- Breaking changes
- Known issues
- Future roadmap

**Length**: ~200 lines

---

### INDEX.md
**Audience**: Developers  
**Content**: This file - comprehensive index of all files

---

## 🐳 Deployment Files

### Dockerfile
**Purpose**: Multi-stage Docker build  
**Base Image**: node:20-alpine  
**Stages**:
1. deps - Install production dependencies
2. runner - Copy and run application

**Features**:
- Playwright browser installation
- Non-root user (agent:1001)
- Log directory creation
- Production optimizations

**Size**: ~500MB (with Chromium)

---

### .dockerignore
**Purpose**: Exclude files from Docker build  
**Excludes**:
- node_modules, logs, .git
- Development files
- .env files

---

### fly.toml
**Purpose**: Fly.io deployment configuration  
**Features**:
- Region: Sao Paulo (gru)
- Health checks
- Auto-scaling
- Volume mounting for logs
- Environment variables

**Resources**:
- Memory: 512MB
- CPU: 1 shared core

---

### .env.example
**Purpose**: Environment variable template  
**Contains**: All configuration options with example values

---

## 🔗 Dependencies

### Production
- `firebase-admin` - Firestore, Storage, Auth
- `winston` - Logging
- `winston-daily-rotate-file` - Log rotation
- `node-cron` - Scheduling
- `playwright` - Browser automation
- `axios` - HTTP client
- `cheerio` - HTML parsing
- `zod` - Schema validation

### Development
- `@types/*` - TypeScript definitions
- `tsx` - TypeScript execution

---

## 📊 Data Flow

```
1. Cron Trigger
   ↓
2. index.ts → runScrapers()
   ↓
3. Parallel execution:
   ├→ GupyScraper.run()
   │  ├→ scrape() [Playwright]
   │  ├→ normalize()
   │  └→ checkBlacklist()
   │
   └→ IndeedBRScraper.run()
      ├→ scrape() [Axios + Cheerio]
      ├→ normalize()
      └→ checkBlacklist()
   ↓
4. Aggregate results
   ↓
5. Log to Firestore (agentRuns)
   ↓
6. Update blacklist
```

---

## 🔑 Key Concepts

### Scraper Lifecycle
1. **Initialize** - Create scraper with config + logger
2. **Scrape** - Platform-specific job extraction
3. **Normalize** - Convert to standard format + generate hash
4. **Deduplicate** - Check against blacklist
5. **Return** - Statistics (scraped, deduped, errors)

### Deduplication
- **Hash**: SHA256(externalId::platform)
- **Storage**: Firestore `jobBlacklist` collection
- **Check**: O(1) document lookup by hash
- **Purpose**: Avoid re-scraping same jobs

### Configuration
- **Source**: Environment variables
- **Validation**: Zod schema
- **Type Safety**: TypeScript inference
- **Defaults**: Sensible defaults for all optional fields

### Error Handling
- **Try/Catch**: Around all async operations
- **Graceful Degradation**: One scraper failure doesn't stop others
- **Cleanup**: Finally blocks for resource cleanup
- **Logging**: Detailed error context

---

## 📈 Metrics

### Performance
- **Gupy**: ~1-2 min per 50 jobs (Playwright)
- **Indeed BR**: ~30-60s per 50 jobs (Cheerio)
- **Memory**: 200-300MB per Playwright instance, 50-100MB for Cheerio
- **Parallelization**: Both run simultaneously

### Reliability
- **Error Recovery**: Continues on single scraper failure
- **Resource Cleanup**: Always closes browsers
- **Health Monitoring**: Built-in health checks
- **Logging**: Comprehensive error tracking

---

## 🎯 Usage Summary

| Task | Command |
|------|---------|
| Development | `npm run agent:dev` |
| Production | `npm run agent:start` |
| Test Single Scraper | `tsx src/agent/examples/run-single-scraper.ts <platform>` |
| Test Deduplication | `tsx src/agent/examples/test-deduplication.ts` |
| Check Health | `curl http://localhost:3001/health` |
| Deploy (Railway) | `railway up` |
| Deploy (Fly.io) | `fly deploy` |
| View Logs | `npm run agent:dev` or `docker logs -f <container>` |

---

## ✅ Completeness Checklist

- [x] Multi-platform scraping (2 platforms)
- [x] Deduplication with hashing
- [x] Data normalization
- [x] Cron scheduling
- [x] Structured logging
- [x] Error handling
- [x] Health checks
- [x] Configuration validation
- [x] Docker support
- [x] Deployment configs (Railway, Fly.io)
- [x] Comprehensive documentation (5 docs)
- [x] Example scripts (2)
- [x] Unit tests
- [x] TypeScript strict mode
- [x] Production-ready code

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
