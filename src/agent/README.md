# Job Scraping Agent

This module implements the autonomous job scraping system for the JobHunter application. It runs as a standalone Node.js container that can be deployed to Railway, Fly.io, or any container platform.

## Architecture

```
src/agent/
├── index.ts                    # Entry point, cron scheduler, orchestration
├── firebase-admin.ts           # Firebase Admin SDK initialization
├── scrapers/
│   ├── base-scraper.ts        # Abstract base class for all scrapers
│   ├── gupy-scraper.ts        # Gupy platform scraper (Playwright)
│   └── indeed-br-scraper.ts   # Indeed Brazil scraper (Axios + Cheerio)
└── utils/
    ├── logger.ts              # Winston logger configuration
    └── deduplication.ts       # Hash generation and blacklist checking
```

## Features

- **Multiple Platform Support**: Gupy and Indeed Brazil with extensible architecture
- **Deduplication**: SHA256 hash-based blacklist to avoid re-scraping jobs
- **Normalization**: Consistent data format across all platforms
- **Scheduling**: Configurable cron-based execution
- **Logging**: Structured JSON logs with Winston (console + file rotation)
- **Error Handling**: Graceful degradation, never crashes on single scraper failure
- **Stealth Scraping**: Playwright with stealth plugin for dynamic sites
- **Rate Limiting**: Respectful delays between requests

## Environment Variables

Required:
- `FIREBASE_SERVICE_ACCOUNT` - JSON string of Firebase service account credentials
- `FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket name

Optional:
- `CRON_SCHEDULE` - Cron expression (default: `'0 */6 * * *'` - every 6 hours)
- `SCRAPER_PLATFORMS` - Comma-separated platforms (default: `'gupy,indeed-br'`)
- `MAX_JOBS_PER_RUN` - Max jobs per scraper per run (default: `50`)
- `SCRAPER_TIMEOUT` - Request timeout in ms (default: `60000`)
- `SCRAPER_USER_AGENT` - Custom user agent string
- `LOG_LEVEL` - `error|warn|info|debug` (default: `info`)
- `TZ` - Timezone for cron (default: `'America/Sao_Paulo'`)
- `RUN_ON_STARTUP` - Set to `'true'` to run immediately on startup
- `NODE_ENV` - `development|production`

## Usage

### Development

```bash
# Install dependencies
npm install

# Run in watch mode
npm run agent:dev

# Run once
npm run agent:start
```

### Production (Docker)

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

CMD ["npm", "run", "agent:start"]
```

### Environment Setup

Create a `.env.local` file:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...",...}'
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
CRON_SCHEDULE=0 */6 * * *
SCRAPER_PLATFORMS=gupy,indeed-br
MAX_JOBS_PER_RUN=50
LOG_LEVEL=info
TZ=America/Sao_Paulo
RUN_ON_STARTUP=false
```

## How It Works

### 1. Scraping Flow

```
Cron Trigger → runScrapers()
  ├→ Instantiate enabled scrapers
  ├→ Run scrapers in parallel (Promise.allSettled)
  ├→ Each scraper:
  │   ├→ scrape() - Fetch jobs from platform
  │   ├→ normalize() - Convert to NormalizedJob format
  │   ├→ checkBlacklist() - Skip duplicates
  │   └→ Return ScraperResult with stats
  └→ Log aggregated results to Firestore
```

### 2. Base Scraper Pattern

All scrapers extend `BaseScraper` which provides:
- `run()` - Orchestrates scrape → normalize → dedup
- `normalize()` - Generates SHA256 hash for deduplication
- `checkBlacklist()` - Queries Firestore `jobBlacklist` collection
- Abstract `scrape()` - Platform-specific implementation

### 3. Deduplication

Jobs are deduplicated using a SHA256 hash of `externalId + platform`:

```typescript
hash = SHA256("job123::gupy")
```

The hash is checked against Firestore collection `jobBlacklist/{hash}`. If found, the job is skipped.

### 4. Data Flow

```
Platform → RawJobInput → NormalizedJob → (if not duplicate) → rawJobs/{userId}/jobs/{hash}
                                       ↓
                                   jobBlacklist/{hash}
```

## Adding a New Scraper

1. Create `src/agent/scrapers/yourplatform-scraper.ts`:

```typescript
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

export class YourPlatformScraper extends BaseScraper {
  async scrape(): Promise<RawJobInput[]> {
    // Your scraping logic here
    return []
  }
}
```

2. Register in `src/agent/index.ts`:

```typescript
case 'yourplatform':
  return new YourPlatformScraper(config, scraperLogger)
```

3. Add to `SCRAPER_PLATFORMS` env var: `gupy,indeed-br,yourplatform`

## Firestore Schema

### jobBlacklist/{hash}
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

### agentRuns/{runId}
```typescript
{
  type: 'scraper'
  timestamp: Timestamp
  duration: number
  totalJobsScraped: number
  totalJobsDeduped: number
  newJobs: number
  totalErrors: number
  platforms: string[]
  status: 'success' | 'completed_with_errors' | 'failed'
  error?: string
}
```

## Logging

Logs are written to:
- **Console**: Colorized in development, JSON in production
- **Files** (production only):
  - `logs/error.log` - Error level and above
  - `logs/combined.log` - All levels

Log format:
```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "Scraper completed",
  "module": "scraper:gupy",
  "platform": "gupy",
  "jobsScraped": 45,
  "jobsDeduped": 12
}
```

**Security**: Sensitive fields (password, token, apiKey, etc.) are automatically redacted.

## Error Handling

- Each scraper runs independently - one failure doesn't stop others
- All async operations wrapped in try/catch
- Errors logged with full context but never expose credentials
- Graceful shutdown on SIGTERM/SIGINT

## Performance

- **Parallel execution**: All scrapers run concurrently
- **Rate limiting**: 2-second delay between pagination requests
- **Timeouts**: Configurable per-scraper timeout (default 60s)
- **Resource cleanup**: Browsers closed in finally blocks
- **Memory efficient**: Streaming where possible

## Monitoring

Check logs for:
- Scraper run statistics
- Error rates
- Deduplication effectiveness
- Performance metrics

Query Firestore `agentRuns` collection for historical data and trends.

## Troubleshooting

### Playwright fails to launch browser
```bash
# Install system dependencies
npx playwright install-deps chromium
```

### Firestore permission errors
- Verify `FIREBASE_SERVICE_ACCOUNT` has correct permissions
- Ensure service account has `Cloud Datastore User` role

### High deduplication rate
- Normal - jobs are scraped every 6 hours but don't change that often
- Adjust `CRON_SCHEDULE` if needed
- Clear `jobBlacklist` collection to re-scrape (use with caution)

### No jobs found
- Check platform website structure hasn't changed
- Review scraper selectors
- Increase `LOG_LEVEL=debug` for detailed extraction logs

## License

Proprietary - Part of JobHunter application
