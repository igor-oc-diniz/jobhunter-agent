# Agent Deployment Guide

This guide covers deploying the Job Scraping Agent to Railway and Fly.io.

## Prerequisites

1. Firebase project with Firestore enabled
2. Service account JSON credentials
3. Railway or Fly.io account

## Option 1: Railway Deployment

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Create New Project

```bash
railway init
```

### Step 3: Set Environment Variables

```bash
# Required
railway variables set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
railway variables set FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Optional (with defaults)
railway variables set CRON_SCHEDULE='0 */6 * * *'
railway variables set SCRAPER_PLATFORMS=gupy,indeed-br
railway variables set MAX_JOBS_PER_RUN=50
railway variables set LOG_LEVEL=info
railway variables set TZ=America/Sao_Paulo
railway variables set NODE_ENV=production
railway variables set RUN_ON_STARTUP=false
railway variables set HEALTH_PORT=3001
```

### Step 4: Deploy

```bash
railway up
```

### Step 5: Configure Health Checks

In Railway dashboard:
1. Go to your service settings
2. Add health check endpoint: `/health`
3. Set health check port: `3001`

## Option 2: Fly.io Deployment

### Step 1: Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### Step 2: Create fly.toml

Create `src/agent/fly.toml`:

```toml
app = "jobhunter-agent"
primary_region = "gru" # Sao Paulo

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  CRON_SCHEDULE = "0 */6 * * *"
  SCRAPER_PLATFORMS = "gupy,indeed-br"
  MAX_JOBS_PER_RUN = "50"
  LOG_LEVEL = "info"
  TZ = "America/Sao_Paulo"
  HEALTH_PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  
  [[http_service.checks]]
    grace_period = "30s"
    interval = "15s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[services]]
  protocol = "tcp"
  internal_port = 3001

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[mounts]
  source = "logs_volume"
  destination = "/app/logs"
```

### Step 3: Set Secrets

```bash
# Set Firebase credentials (paste the entire JSON string when prompted)
fly secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
fly secrets set FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

### Step 4: Create Volume for Logs

```bash
fly volumes create logs_volume --region gru --size 1
```

### Step 5: Deploy

```bash
cd src/agent
fly deploy
```

### Step 6: Monitor

```bash
# View logs
fly logs

# Check status
fly status

# SSH into container
fly ssh console
```

## Option 3: Generic Docker Deployment

### Build Image

```bash
cd src/agent
docker build -t jobhunter-agent:latest .
```

### Run Container

```bash
docker run -d \
  --name jobhunter-agent \
  --restart unless-stopped \
  -p 3001:3001 \
  -e FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
  -e FIREBASE_STORAGE_BUCKET=your-project.appspot.com \
  -e CRON_SCHEDULE='0 */6 * * *' \
  -e SCRAPER_PLATFORMS=gupy,indeed-br \
  -e MAX_JOBS_PER_RUN=50 \
  -e LOG_LEVEL=info \
  -e NODE_ENV=production \
  -e TZ=America/Sao_Paulo \
  -v $(pwd)/logs:/app/logs \
  jobhunter-agent:latest
```

### Check Health

```bash
curl http://localhost:3001/health
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Yes | - | Firebase service account JSON |
| `FIREBASE_STORAGE_BUCKET` | No | - | Firebase Storage bucket |
| `CRON_SCHEDULE` | No | `0 */6 * * *` | Cron expression for scraper runs |
| `SCRAPER_PLATFORMS` | No | `gupy,indeed-br` | Comma-separated platform list |
| `MAX_JOBS_PER_RUN` | No | `50` | Max jobs per scraper per run |
| `SCRAPER_TIMEOUT` | No | `60000` | Request timeout in milliseconds |
| `SCRAPER_USER_AGENT` | No | Chrome UA | Custom user agent |
| `LOG_LEVEL` | No | `info` | `error\|warn\|info\|debug` |
| `NODE_ENV` | No | `development` | Node environment |
| `TZ` | No | `America/Sao_Paulo` | Timezone for cron |
| `RUN_ON_STARTUP` | No | `false` | Run immediately on container start |
| `HEALTH_PORT` | No | `3001` | Health check HTTP port |

## Monitoring and Maintenance

### View Logs

**Railway:**
```bash
railway logs
```

**Fly.io:**
```bash
fly logs
```

**Docker:**
```bash
docker logs -f jobhunter-agent
```

### Check Firestore Logs

Query the `agentRuns` collection to see historical scraper execution:

```javascript
// In Firebase Console or code
db.collection('agentRuns')
  .where('type', '==', 'scraper')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get()
```

### Health Monitoring

Set up uptime monitoring with services like:
- UptimeRobot
- Better Uptime
- Pingdom

Point to: `https://your-agent-domain.com/health`

Expected response when healthy:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "uptime": 3600,
  "checks": {
    "firestore": true,
    "memory": true
  }
}
```

### Scaling Considerations

**Memory:**
- Gupy scraper (Playwright): ~200-300MB per run
- Indeed scraper (Cheerio): ~50-100MB per run
- Recommended: 512MB minimum, 1GB recommended

**CPU:**
- Playwright is CPU-intensive during page rendering
- Recommended: 1 CPU minimum, 2 CPUs for better performance

**Storage:**
- Logs rotate automatically
- Playwright browser cache: ~200MB
- Recommended: 1GB minimum

### Troubleshooting

#### Playwright fails to launch

**Railway/Fly.io:** Install system dependencies in Dockerfile
```dockerfile
RUN npx playwright install-deps chromium
```

#### Out of memory errors

Increase container memory or reduce `MAX_JOBS_PER_RUN`:
```bash
fly scale memory 1024  # Fly.io
```

#### Firestore permission errors

Verify service account has correct roles:
- Cloud Datastore User
- Firebase Admin

#### Jobs not being scraped

1. Check logs for errors
2. Verify cron schedule is correct
3. Test scrapers manually:
   ```bash
   tsx src/agent/examples/run-single-scraper.ts gupy
   ```

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all secrets
3. **Rotate service accounts** periodically
4. **Monitor logs** for suspicious activity
5. **Keep dependencies updated** for security patches
6. **Use HTTPS** for health check endpoints
7. **Implement rate limiting** if exposing public endpoints

## Cost Optimization

1. **Adjust cron schedule**: Every 6 hours vs every hour
2. **Limit max jobs**: Reduce `MAX_JOBS_PER_RUN`
3. **Use auto-scaling**: Stop machines when idle (Fly.io)
4. **Optimize scraper selectors**: Faster execution = lower cost
5. **Monitor Firestore usage**: Reads/writes count toward quota

## Production Checklist

- [ ] Firebase service account created and secured
- [ ] Environment variables set correctly
- [ ] Health check endpoint responding
- [ ] Cron schedule validated
- [ ] Logs being written and rotated
- [ ] Firestore rules configured
- [ ] Uptime monitoring configured
- [ ] Error alerting set up
- [ ] Documentation updated
- [ ] Team trained on deployment process

## Support

For issues:
1. Check logs first
2. Review Firestore `agentRuns` collection
3. Test scrapers manually with examples
4. Verify environment variables
5. Check platform status (Railway/Fly.io)
