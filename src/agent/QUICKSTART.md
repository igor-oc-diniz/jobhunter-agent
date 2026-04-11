# Quick Start Guide - Job Scraping Agent

Get the agent running in 5 minutes.

## Prerequisites

1. Node.js 20+
2. Firebase project with Firestore enabled
3. Firebase service account JSON

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Get Firebase Credentials

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Copy the entire JSON content (it's a single line)

## Step 3: Set Environment Variables

Create `.env.local` in the project root:

```bash
# Required
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Optional (defaults shown)
CRON_SCHEDULE='0 */6 * * *'
SCRAPER_PLATFORMS=gupy,indeed-br
MAX_JOBS_PER_RUN=50
LOG_LEVEL=info
NODE_ENV=development
TZ=America/Sao_Paulo
RUN_ON_STARTUP=true
```

**Important**: Replace `your-project-id` and `your-project.appspot.com` with your actual Firebase project details.

## Step 4: Run the Agent

### Development (with auto-restart)
```bash
npm run agent:dev
```

### Single Run
```bash
npm run agent:start
```

## Step 5: Verify It's Working

### Check Logs
You should see:
```
2024-01-15 10:30:45 [info] [agent-container]: Agent container started successfully
2024-01-15 10:30:45 [info] [scraper:gupy]: Starting scraper run
2024-01-15 10:30:50 [info] [scraper:indeed-br]: Starting scraper run
```

### Check Health Endpoint
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 60,
  "checks": {
    "firestore": true,
    "memory": true
  }
}
```

### Check Firestore
1. Go to Firebase Console → Firestore Database
2. Look for collections:
   - `agentRuns` - Should have run logs
   - `jobBlacklist` - Will populate as jobs are scraped

## Step 6: Test Manual Scraping

Run a single scraper to test:

```bash
# Test Gupy scraper
tsx src/agent/examples/run-single-scraper.ts gupy

# Test Indeed BR scraper
tsx src/agent/examples/run-single-scraper.ts indeed-br
```

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT is not set"
- Make sure you created `.env.local` in the project root (not in `src/agent/`)
- The JSON must be a single-line string wrapped in quotes
- Check that you copied the entire JSON from Firebase

### "Failed to initialize Firebase Admin SDK"
- Verify the JSON is valid (use a JSON validator)
- Check that the service account has Firestore permissions
- Make sure you're using the correct project ID

### Playwright fails to launch
```bash
# Install browsers
npx playwright install chromium

# Install system dependencies (Linux)
npx playwright install-deps chromium
```

### "Permission denied" errors in Firestore
1. Go to Firebase Console → Firestore → Rules
2. Temporarily set to allow all (for testing):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
**Note**: Don't use this in production! Set proper rules later.

### No jobs being scraped
- Check if the platforms are accessible from your network
- Try increasing `LOG_LEVEL=debug` for more details
- Verify `MAX_JOBS_PER_RUN` is set to a reasonable number (10-50)

## Next Steps

Once the agent is running successfully:

1. **Configure scraping schedule**: Adjust `CRON_SCHEDULE` to your needs
   - Every 6 hours: `0 */6 * * *`
   - Twice a day (9am, 6pm): `0 9,18 * * *`
   - Every day at midnight: `0 0 * * *`

2. **Monitor execution**: Check `agentRuns` collection in Firestore for statistics

3. **Deploy to production**: Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway or Fly.io

4. **Add more platforms**: See [README.md](./README.md) for instructions on creating new scrapers

## Common Commands

```bash
# Development mode (auto-restart on file changes)
npm run agent:dev

# Production mode (single run)
npm run agent:start

# Test deduplication logic
tsx src/agent/examples/test-deduplication.ts

# Run tests
npm test

# Check health
curl http://localhost:3001/health

# View logs (if in production)
tail -f logs/combined.log
```

## Configuration Quick Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `CRON_SCHEDULE` | `0 */6 * * *` | When to run (cron format) |
| `SCRAPER_PLATFORMS` | `gupy,indeed-br` | Which platforms to scrape |
| `MAX_JOBS_PER_RUN` | `50` | Jobs per platform per run |
| `LOG_LEVEL` | `info` | `error\|warn\|info\|debug` |
| `RUN_ON_STARTUP` | `false` | Run immediately on start |
| `TZ` | `America/Sao_Paulo` | Timezone for cron |

## Getting Help

- Check the logs first: `npm run agent:dev`
- Review [README.md](./README.md) for architecture details
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- Verify Firestore rules and permissions
- Test with example scripts in `src/agent/examples/`

## Success Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Firebase service account JSON obtained
- [ ] `.env.local` created with valid credentials
- [ ] Agent starts without errors
- [ ] Health endpoint returns 200
- [ ] Firestore `agentRuns` collection has entries
- [ ] Jobs appear in `jobBlacklist` collection
- [ ] Manual scraper test works
- [ ] Cron schedule is correct for your timezone

You're all set! The agent will now scrape jobs automatically based on your cron schedule. 🎉
