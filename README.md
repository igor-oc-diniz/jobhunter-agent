# JobHunter Agent

Autonomous job application agent: scrapes jobs → semantic matching → personalized CV + cover letter → form filling → real-time dashboard.

## What it does

1. **Scrapes** job listings from 9 platforms on a configurable cron schedule
2. **Matches** jobs against your profile using weighted scoring + Claude analysis
3. **Generates** a tailored CV (PDF) and cover letter for each matched job
4. **Fills** application forms automatically via Playwright *(Module 06 — in progress)*
5. **Tracks** everything in a real-time dashboard with Kanban, analytics, and agent logs

## Stack

| Layer | Technology |
|---|---|
| Agent runtime | Node.js 20+, TypeScript strict |
| LLM | Claude API (`claude-sonnet-4-5`) |
| Browser automation | Playwright + stealth plugin |
| HTTP scraping | Axios + Cheerio |
| PDF generation | Puppeteer → Handlebars → A4 PDF |
| Job queue | BullMQ + Redis (Upstash) |
| Frontend | Next.js 14 App Router, Tailwind, shadcn/ui |
| Database | Firebase Firestore + Storage + Auth |
| Deploy | Fly.io (`gru` region) |

## Supported platforms

Remotive, Indeed (BR / CA / AU), WeWorkRemotely, Himalayas, Wellfound, RemoteOK, Arbeitnow

## Running locally

```bash
# Dashboard (Next.js)
npm run dev

# Agent (with file watch)
npm run agent:dev
```

Requires `.env.local` — copy `.env.local.example` and fill in your keys:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config |
| `FIREBASE_*` | Firebase Admin SDK (backend + agent) |
| `REDIS_URL` / `REDIS_TOKEN` | Upstash Redis |
| `RESEND_API_KEY` | Transactional email |

## Deploy

The agent runs as a standalone Node.js process on Fly.io, separate from the Next.js dashboard.

```bash
# Deploy agent to Fly.io
fly deploy

# Deploy Firestore security rules
firebase deploy --only firestore:rules
```

## Project structure

```
src/
  app/              → Next.js dashboard (App Router)
    actions/        → All Firestore reads/writes (Admin SDK only)
  agent/            → Standalone Node.js agent
    pipeline.ts     → Main pipeline orchestrator
    scrapers/       → One file per platform
    matching/       → Weighted score + Claude semantic analysis
    cv/             → CV generation (Claude → Handlebars → Puppeteer → PDF)
    cover-letter/   → Cover letter generation (tone + language auto-detected)
    form-filler/    → Playwright form automation (in progress)
  components/       → React components (design system + dashboard organisms)
  types/            → Shared TypeScript types
```
