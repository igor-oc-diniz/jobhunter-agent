# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Autonomous job application agent. Given the user's professional profile, it executes the full application cycle: scrapes job openings → semantic matching → personalized CV and cover letter generation → automatic form filling → real-time pipeline tracking on a dashboard.

---

## Stack

### Agent (Node.js container — Railway or Fly.io)
| Layer | Technology |
|-------|-----------|
| LLM | Claude API — model `claude-sonnet-4-5` |
| Language | TypeScript (Node.js 20+) |
| Browser automation | Playwright + `playwright-extra` + stealth plugin |
| Job queue | BullMQ + Redis (Upstash) |
| Scheduler | node-cron |
| PDF generation | Puppeteer (HTML → PDF) |
| Template engine | Handlebars |
| HTTP / static scraping | Axios + Cheerio |
| Logger | Winston (structured JSON) |

### Frontend (Next.js — Vercel)
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router |
| UI | Tailwind CSS + shadcn/ui |
| Global state | Zustand |
| Data fetching | React Query + Firestore SDK |
| Forms | React Hook Form + Zod |
| Drag & Drop | dnd-kit |
| Charts | Recharts |

### Data
| Layer | Technology |
|-------|-----------|
| Main database | Firebase Firestore |
| File storage | Firebase Storage (CVs, screenshots) |
| Auth | Firebase Auth (Google OAuth) |
| Cache / queue | Redis via Upstash |
| Transactional email | Resend |

---

## High-Level Architecture

```
Dashboard (Next.js / Vercel)
        │ Firestore real-time listeners
        ▼
Agent (Node.js container)
  Scheduler (cron) → Orchestrator (Claude tool use) → BullMQ Queue
                              │
          ┌───────────────────┼────────────────────┐
          ▼                   ▼                    ▼
      Scraper            CV + Cover Letter     Form Filler
  (Playwright/Cheerio)   (Claude API)      (Playwright + Claude)
          │                   │                    │
          └───────────────────▼────────────────────┘
                         Firebase
                   (Firestore + Storage)
```

The **Orchestrator** is implemented as a Claude agent with **tool use**: Claude receives the current pipeline state and decides which tool to call next. The loop runs until `stop_reason === 'end_turn'` or a 50-iteration safety limit.

---

## Modules and Dependency Order

Implement in this order — each module depends on the previous ones:

| # | Module | Description |
|---|--------|-------------|
| 01 | User Profile | Multi-step wizard, Firestore persistence, Claude-generated summary |
| 01b | Profile Import | CV/LinkedIn import: user uploads PDF or pastes LinkedIn URL → Claude extracts structured data → pre-fills wizard fields; user reviews before saving |
| 02 | Job Scraping | Playwright/Cheerio per platform, deduplication, normalization to `RawJob` |
| 03 | Semantic Matching | Weighted 0-100 score + Claude analysis, prioritized queue |
| 04 | CV Generation | Claude personalizes content per job → Handlebars → Puppeteer → PDF → Storage |
| 05 | Cover Letter | Claude generates ~250 words adapting tone to company culture |
| 06 | Form Filler | Playwright maps DOM, Claude fills fields, semi-auto mode with user confirmation |
| 07 | Firebase (infra) | Firestore rules, Storage rules, composite indexes, TypeScript DAL |
| 08 | Dashboard Base | Next.js App Router, Firebase Auth, route protection middleware |
| 09 | Kanban | Drag & drop applications, detail panel, semi-auto confirmation UI |
| 10 | Analytics | Funnel/conversion charts, period filters, CSV export |
| 11 | Orchestrator | BullMQ + cron + Claude agentic loop, daily limit control |
| 12 | Notifications | In-app (Firestore listener) + transactional email (Resend) |

---

## Firestore Structure

```
users/{userId}/
  profile/              → UserProfile (single document at path .../profile/data)
  rawJobs/{jobId}/      → RawJob (scraper output, status: pending→matched/rejected/applied)
  applicationQueue/{jobId}/  → ApplicationQueueItem (priority queue by score)
  applications/{jobId}/ → Application (full application + stage timeline)
  blacklist/{entryId}/  → BlacklistEntry (processed URLs — immutable)
  agentLogs/{runId}/    → AgentRunLog (structured log per execution)
  notifications/{notifId}/ → Notification

system/platformStatus/{platform}/  → blocking status (write via Admin SDK only)
```

**Critical rule**: a job URL in the blacklist is never reprocessed. Jobs rejected by low score are also added to the blacklist with `reason: 'score_too_low'`.

---

## App Router Structure

```
src/app/
  (auth)/login/              → Google sign-in page
  (dashboard)/               → layout: sidebar + topbar (force-dynamic)
    applications/            → Kanban board
    applications/[jobId]/    → Application detail
    analytics/               → Charts and metrics
    profile/setup/           → Multi-step wizard (first access)
    profile/edit/            → Profile editing
    agent/                   → Status, logs, agent controls
    settings/                → Agent configuration
  api/auth/session/          → POST/DELETE session cookie
  middleware.ts              → Protects routes; redirects to /profile/setup if profile doesn't exist
```

---

## Main Execution Flow

```
1. Scheduler (node-cron) fires at user-configured hours
2. Orchestrator reads profile + checks daily limit (maxApplicationsPerDay)
3. Scraper fetches jobs from enabled platforms
4. Matching filters jobs (score ≥ threshold, default 70)
5. For each approved job (priority order):
   a. Check blacklist → skip if already processed
   b. Generate personalized CV → Storage
   c. Generate cover letter
   d. Form Filler: maps DOM via Claude, fills fields
   e. If semi-automatic: pause, notify user (screenshot + email), wait up to 4h
   f. Submit form
   g. Save Application to Firestore, add URL to blacklist
6. Dashboard updates in real-time via Firestore listeners
```

---

## Matching Score Algorithm

Weighted criteria (total = 100%):

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Tech stack | 35% | % of job technologies present in profile |
| Seniority | 20% | Compatibility between required and declared level |
| Contract type | 15% | CLT/PJ match |
| Modality | 10% | Remote/onsite match |
| Salary range | 10% | Job salary within expectation |
| Semantic context | 10% | Claude qualitative assessment |

Pre-filtering (no Claude call) happens first to save tokens. Claude is only called for jobs with estimated score ≥ 50.

---

## CV Generation Pipeline

```
1. Load profile + rawJob + matchDetails
2. Check cache: CV exists and < 24h old? → return existing URL
3. Call Claude → receive personalized CVContent (JSON)
4. Validate JSON with Zod
5. Compile Handlebars template with CVContent + personal data
6. Launch Puppeteer, load HTML
7. Generate PDF: A4, 15mm margins, no headers/footers, max 2 pages
8. Upload PDF to Firebase Storage (path: cvs/{userId}/{jobId}/{timestamp}.pdf)
9. Return { pdfUrl, generatedAt }
```

---

## Form Filler — Fields Never Auto-Filled

Even in automatic mode, the agent must pause and notify the user for:
- CPF / CNPJ
- Bank details
- Passwords of any kind
- Document numbers (ID, passport)
- Health information

---

## Scraping Platforms

**Focus: international / remote-first jobs.**

| Platform | Strategy | Anti-bot difficulty | Status |
|----------|-----------|---------------------|--------|
| Remotive | Public REST API (axios) | None | ✅ implemented |
| Indeed BR | Playwright + stealth | High | ✅ implemented |
| We Work Remotely | RSS + Cheerio (axios) | Very low | ✅ implemented |
| Wellfound (AngelList) | Playwright + stealth | High (DataDome) | ✅ implemented |
| Himalayas | Public JSON API (axios) | Low | ✅ implemented |
| RemoteOK | Public JSON API (axios) | None | ✅ implemented |
| Arbeitnow | Public JSON API (axios) | None | ✅ implemented |
| Indeed CA | Playwright + stealth | High | ✅ implemented |
| Indeed AU | Playwright + stealth | High | ✅ implemented |
| LinkedIn | Playwright | High | out of scope (v1) |
| Gupy | Playwright (SPA) | Low | deprioritized — poor application UX |

**Default platforms** (env `SCRAPER_PLATFORMS`): `remotive,indeed-br`

**Remotive**: Public REST API (`remotive.com/api/remote-jobs`). Categories: `software-dev`, `devops-sysadmin`, `data`. No browser — pure axios.

**Indeed BR / CA / AU**: Playwright + stealth. Job data extracted from `window.mosaic.providerData["mosaic-provider-jobcards"]` embedded JSON. BR uses `pt-BR`/`America/Sao_Paulo`, CA uses `en-CA`/`America/Toronto`, AU uses `en-AU`/`Australia/Sydney`.

**We Work Remotely**: RSS feeds for 5 dev categories. Parses "Company | Title" format in `<title>` tags. Per-feed job budget to spread across categories.

**Himalayas**: `https://himalayas.app/jobs/api` — paginated 100/page up to 5 pages. API ignores category params; filter applied client-side via `DEV_CATEGORY_PATTERNS`.

**RemoteOK**: `https://remoteok.com/api` — first element is metadata (skipped). Requires `Referer: https://remoteok.com/` header (403 without it).

**Arbeitnow**: `https://www.arbeitnow.com/api/job-board-api` — EU/Germany-focused. Paginated, stops when `data.links.next` is absent.

**Wellfound**: Playwright + stealth. Primary: `__NEXT_DATA__` recursive JSON walker. Fallback: `window.__APOLLO_STATE__`. Detects DataDome/Cloudflare challenge and exits cleanly with 0 jobs.

All scrapers share a `BaseScraper` abstract class. Failures per platform are isolated — one failing platform does not stop the others.

---

## Orchestrator Tool Use

Claude acts as the orchestrator via tool use. Available tools:
- `run_scraper` — runs scraper for a specific platform
- `run_matching` — processes pending jobs and calculates scores
- `generate_cv` — generates personalized CV for a job
- `generate_cover_letter` — generates cover letter
- `fill_and_submit_form` — fills and submits the application form
- `get_pipeline_status` — returns current pipeline state
- `update_agent_status` — updates agent status in Firestore for the dashboard

The loop has a 50-iteration safety limit per cycle. A Redis lock prevents concurrent cycles for the same user.

---

## Development Commands

```bash
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
```

Firebase local emulators:
```bash
firebase emulators:start --only firestore,storage,auth
```

> **Note**: `npm run build` uses `node node_modules/next/dist/bin/next build` if `npx next build` fails due to a Node.js bin resolution issue on this machine.

---

## Environment Variables

```env
# Claude API
ANTHROPIC_API_KEY=

# Firebase Admin (backend/agent only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Client (frontend — NEXT_PUBLIC_ prefix required)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Redis (Upstash)
REDIS_URL=
REDIS_TOKEN=

# Email
RESEND_API_KEY=

# Agent defaults
AGENT_MIN_SCORE=70
AGENT_MAX_APPLICATIONS_DAY=10
AGENT_MODE=semi-automatic
```

The Firebase client (`src/lib/firebase/client.ts`) uses a lazy singleton pattern — instances are only created on first call, making it SSR-safe during Next.js build.

---

## Design System — Neon Command

**Reference files** (read before creating any UI component):
- `docs/designsystem/neon_command/DESIGN.md` — creative strategy, rules, do's and don'ts
- `docs/designsystem/atomic_design_system_neon_command/code.html` — full Tailwind config + atomic design HTML examples
- `docs/designsystem/component_library_neon_command/code.html` — full component library with all states

### Key rules
- **Fonts**: `font-headline` / `font-label` = Space Grotesk; `font-body` = Manrope (default body font)
- **Surfaces** (dark → light): `surface-container-lowest` (#0e0e0e) → `surface-container-low` (#1c1b1b) → `surface-container` (#201f1f) → `surface-container-high` (#2a2a2a) → `surface-container-highest` (#353534)
- **No-Line Rule**: never use `1px solid border` for layout — use surface level shifts
- **No black**: use `bg-background` (#131313) not `bg-black`
- **Rounding**: minimum `rounded-[1rem]` always; cards use `rounded-[1.5rem]`; modals use `rounded-[2rem]`
- **Glassmorphism**: use `glass-panel` utility class (`bg: rgba(32,31,31,0.6)`, `backdrop-blur-xl`, ghost border)
- **Dot-grid**: use `dot-grid` utility on background layers (already applied to `body`)
- **Shadows**: use `shadow-neon` (tinted green ambient), never black shadows
- **Primary action color**: `primary-container` (#00ff88 neon green); secondary info: `secondary-container` (#00e0ff blue)
- **Ghost border** (if required): `border-outline-variant/15` — felt not seen
- **Hover on cards**: `hover:scale-[1.02] hover:border-primary-container/20 hover:shadow-neon`
- **Status dots**: `StatusBeacon` atom — pulsating for active states
- **Section headers**: `text-[10px] font-label uppercase tracking-widest text-outline`

### Atomic design component locations
- **Atoms**: `src/components/design-system/atoms/` — `StatusBeacon`, `StatusBadge`, `ScoreBadge`, `Chip`
- **Molecules**: `src/components/design-system/molecules/` — `StatCard`, `NotificationItem`
- **Organisms**: reuse/extend components in `src/components/dashboard/`
- **Barrel export**: `src/components/design-system/index.ts`

---

## Code Conventions

- **Language**: English everywhere — code, UI text, comments, error messages, labels
- **Files**: kebab-case
- **Async functions**: always explicit `try/catch` with logger
- **Logs**: structured JSON with `level`, `action`, `timestamp` — never log credentials
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **TypeScript**: strict mode, no implicit `any`
- **Claude JSON output**: always validate with Zod before using
- **Firebase client**: never call `getAuth()`, `getDb()`, `getStorage()` at module level — always inside functions

---

## Security Rules Summary

- **Firestore**: users can only read/write their own documents; `system/` collection is write-protected (Admin SDK only)
- **Storage**: users can read their own CVs; screenshots are write-protected (Admin SDK only)
- **Rate limiting**: random 2–8s delays between requests, 10–30s between platforms
- **Anti-bot**: user-agent rotation, stealth plugin, real viewport and locale (`pt-BR`, `America/Sao_Paulo`)
- **CAPTCHA**: detect and pause always — never attempt to bypass; notify user
- **API keys**: never expose server keys in frontend; `NEXT_PUBLIC_` only for Firebase Client SDK

---

## Key Type Definitions

All types live in `src/types/`:
- `UserProfile` — full user profile including `AgentConfig`
- `RawJob` — scraper output with `status` field driving the pipeline
- `Application` — full application record with `ApplicationStatus` union type
- `MatchDetails` — scoring breakdown attached to `RawJob`
- `Notification` — in-app notification with `NotificationType` union
- `AgentStatus`, `AgentRunLog`, `AgentLogEntry` — agent runtime types in `src/types/agent.ts`

`ApplicationStatus` values: `queued | processing | awaiting_confirmation | applied | viewed | screening | interview_hr | interview_tech | offer | hired | rejected | withdrawn | failed`

---

## Server Actions Pattern (Critical)

All Firestore reads/writes in the dashboard use **Firebase Admin SDK via Next.js Server Actions** in `src/app/actions/`. Never use the Firebase client SDK in dashboard components. This pattern avoids client-side auth issues during SSR.

```
src/app/actions/
  notifications.ts     → getNotificationsAction, markNotificationReadAction, markAllNotificationsReadAction
  agent.ts             → getAgentStatusAction, getAgentLogsAction, triggerAgentRunAction
  settings.ts          → getAgentConfigAction, saveAgentConfigAction
  applications.ts      → application CRUD
  profile.ts           → profile read/write
  profile-import.ts    → importFromCVAction (pdf-parse + Claude), importFromLinkedInAction (blocked — returns helpful error)
```

**Firestore index pitfall**: Combining `where()` + `orderBy()` on different fields requires a composite index. When filtering by `read == false`, remove `orderBy` from the query and sort results in memory instead. This avoids needing manual index creation.

---

## Firestore Structure (Extended)

Beyond the base structure, agent runtime uses:

```
users/{userId}/
  agentStatus/current   → { status, lastRunAt, nextRunAt, currentJob, updatedAt, triggeredManually }
  agentLogs/{runId}/    → AgentRunLog { startedAt, finishedAt, status, applicationsProcessed, applicationsSubmitted, errors, entries[] }
  profile/data          → UserProfile including agentConfig field (AgentConfig)
```

`AgentConfig` lives nested inside `UserProfile.agentConfig` and is persisted via `saveAgentConfigAction` using a Firestore `merge` update on `users/{userId}/profile/data`.

---

## Current Project State (as of 2026-04-16)

### Git branches
- `main` — stable base
- `develop` — current integration branch

### What is implemented
| Feature | Status | Key files |
|---------|--------|-----------|
| Neon Command design system | ✅ Done | `src/app/globals.css`, `src/components/design-system/` |
| Auth flow (Google OAuth) | ✅ Done | `src/app/(auth)/login/`, `src/app/auth/finalize/`, `src/lib/auth/server.ts` |
| Dashboard layout (sidebar + topbar) | ✅ Done | `src/components/dashboard/Sidebar.tsx`, `Topbar.tsx` |
| Kanban board (`/applications`) | ✅ Done | `src/components/dashboard/KanbanBoard.tsx`, `KanbanColumn.tsx`, `ApplicationCard.tsx` |
| Application detail (`/applications/[jobId]`) | ✅ Done | `src/components/dashboard/ApplicationDetail.tsx` |
| Analytics (`/analytics`) | ✅ Done | `src/components/dashboard/AnalyticsDashboard.tsx` |
| User profile wizard (`/profile/setup`) | ✅ Done | `src/components/profile/` — multi-step wizard |
| Profile Import (Module 01b) | ✅ Done | `src/app/actions/profile-import.ts`, `src/components/profile/steps/StepImport.tsx` |
| Agent panel (`/agent`) | ✅ Done | `src/components/dashboard/AgentPanel.tsx`, `src/app/actions/agent.ts` |
| Settings form (`/settings`) | ✅ Done | `src/components/dashboard/SettingsForm.tsx`, `src/app/actions/settings.ts` |
| Notification center (topbar) | ✅ Done | `src/components/dashboard/NotificationCenter.tsx`, `src/app/actions/notifications.ts` |
| Agent HTTP server | ✅ Done | `src/agent/server.ts` — Express on port 3001, `POST /run` triggers pipeline |
| Agent ↔ Dashboard integration | ✅ Done | Dashboard "Run now" → `triggerAgentRunAction` → `POST localhost:3001/run` → pipeline |
| Semantic Matching (Module 03) | ✅ Done | `src/agent/matching/matcher.ts` — weighted score + Claude analysis + Zod validation |
| Indeed BR scraper | ✅ Done | `src/agent/scrapers/indeed-br-scraper.ts` — Playwright + stealth, parses embedded JSON |
| Agent real-time UX | ✅ Done | `AgentPanel.tsx` adaptive polling (3s/15s), live step label, run logs written to Firestore |
| Remotive scraper | ✅ Done | `src/agent/scrapers/remotive-scraper.ts` — public REST API, categories: software-dev, devops, data |
| We Work Remotely scraper | ✅ Done | `src/agent/scrapers/weworkremotely-scraper.ts` — RSS feeds (5 dev categories), axios + cheerio |
| Himalayas scraper | ✅ Done | `src/agent/scrapers/himalayas-scraper.ts` — JSON API, paginated, client-side category filter |
| Wellfound scraper | ✅ Done | `src/agent/scrapers/wellfound-scraper.ts` — Playwright + stealth, `__NEXT_DATA__` extraction, DataDome detection |
| RemoteOK scraper | ✅ Done | `src/agent/scrapers/remoteok-scraper.ts` — public JSON API, requires `Referer` header |
| Arbeitnow scraper | ✅ Done | `src/agent/scrapers/arbeitnow-scraper.ts` — public JSON API, EU-focused, paginated |
| Indeed CA scraper | ✅ Done | `src/agent/scrapers/indeed-ca-scraper.ts` — Playwright + stealth, `ca.indeed.com`, mosaic JSON |
| Indeed AU scraper | ✅ Done | `src/agent/scrapers/indeed-au-scraper.ts` — Playwright + stealth, `au.indeed.com`, mosaic JSON |
| CV Generation (Module 04) | ✅ Done | `src/agent/cv/cv-generator.ts` — Claude → Handlebars → Puppeteer PDF → Firebase Storage |
| Cover Letter (Module 05) | ✅ Done | `src/agent/cover-letter/cover-letter-generator.ts` — Claude, auto-detects tone + language |

### What is NOT implemented yet
| Feature | Priority | Notes |
|---------|----------|-------|
| Deploy agent container (Fly.io) | High | `src/agent/fly.toml` ready, needs env vars + deploy |
| Firestore security rules | Medium | Module 07 — rules + composite indexes not deployed |
| BullMQ / Redis queue | Medium | Upstash Redis vars empty |
| Form Filler (Module 06) | Medium | Not started |
| Transactional email (Resend) | Low | Module 12 email side — only in-app notifications done |

### Known issues / tech debt
- Next.js middleware deprecation warning: `middleware` → `proxy` (cosmetic, not breaking)
- `useSearchParams()` Suspense wrapping needed on new pages that use search params
- Agent health status shows `degraded` locally due to memory threshold (expected — tsx uses more RAM than production container)
- `.env.local` comments inline break env var parsing — never add `# comment` after a value on the same line
- `HimalayadScraper` class name has a typo (double `d`) — functional but should be renamed in a future cleanup

### AgentPanel metrics mapping
| UI label | Firestore field | What it counts |
|----------|----------------|----------------|
| Total runs | `agentLogs` doc count | Pipeline triggers (manual or cron) |
| Jobs scraped | `applicationsProcessed` | Raw jobs collected by scrapers |
| Matched jobs | `applicationsSubmitted` | Jobs that passed matching → `applicationQueue` |
| Errors | `errors` | Scraping/processing failures per run |

> `applicationsSubmitted` is populated with `matchedSnap.size` in `pipeline.ts`. The name will map to real form submissions once Module 06 (Form Filler) is implemented.

### Next recommended steps
1. Deploy agent container to Fly.io
2. Module 06 — Form Filler (Playwright DOM mapping + Claude field filling)
3. Firestore security rules (Module 07)

### Module 01b — Profile Import: Implementation Notes

**Files:**
- `src/app/actions/profile-import.ts` — `importFromCVAction(formData)`: pdf-parse extracts text → Claude extracts structured JSON → Zod validates → returns `Partial<UserProfile>`
- `src/components/profile/steps/StepImport.tsx` — full-screen upload card (drag & drop, loading state, LinkedIn PDF tip, Manual Setup fallback)
- `src/components/profile/ProfileForm.tsx` — `showImportStep` prop renders StepImport before Step 0; `importVersion` key forces remount of RHF steps after import

**Key decisions:**
- LinkedIn direct scraping blocked by HTTP 999 — users guided to LinkedIn "Save to PDF" instead
- `stripNulls()` helper removes `null` values Claude returns before Zod validation
- `pdf-parse` must be v1 (not v2) — v2 has a completely different class-based API
- `require('pdf-parse')` (not dynamic `import()`) to avoid Next.js ESM issues

---

## Dev Agent — Parallel Feature Builder

The project includes a TypeScript dev-agent system at `dev-agents/` that builds features using two parallel workers (Design + Services). **Always use this system instead of writing components or server actions by hand.**

### When to use it

Use `npm run dev-agent` whenever the user asks to:
- Create a new UI component or page
- Add a server action or Firestore query
- Implement a feature that touches both frontend and backend
- Extend an existing component with new props or behavior

Do NOT use it for:
- Fixing a specific bug in an existing file (just edit the file directly)
- Updating config files (`tailwind.config.ts`, `tsconfig.json`, etc.)
- Writing one-liner changes or renaming things

### How to call it

```bash
npm run dev-agent "Descrição clara da feature em inglês"
```

With a Figma reference:
```bash
npx tsx dev-agents/orchestrator.ts --figma "https://figma.com/..." "Feature description"
```

### What it does internally

1. Reads project context (`CLAUDE.md`, `src/types/index.ts`, design-system index, existing components)
2. Calls Claude once to produce a `FeaturePlan`: shared TypeScript types + Design task + Services task
3. Launches two workers in parallel via `Promise.all`:
   - **Design Worker** — creates React components following Neon Command design system, atomic design, `forwardRef`, `data-testid`, tests
   - **Services Worker** — creates Server Actions, Firestore DAL functions, Zod schemas, winston logs
4. Prints a unified report with files created, autonomous decisions, and TODOs requiring review

### Files

```
dev-agents/
  orchestrator.ts   → entry point (planning + parallel dispatch + report)
  worker.ts         → generic agentic loop (tool use until task_complete)
  tools.ts          → tool definitions: read_file, write_file, list_directory, run_bash
  types.ts          → shared interfaces: WorkerTask, WorkerResult, FeatureRequest
  tsconfig.json     → Node.js-compatible tsconfig (separate from Next.js root config)
```

### Design conventions the Design Worker follows

All components must comply with the **Neon Command** design system (see `docs/designsystem/`):
- Background: `bg-background` (`#131313`) — never `bg-black`
- Primary: `primary-container` (`#00ff88`); secondary: `secondary-container` (`#00e0ff`)
- Minimum rounding: `rounded-[1rem]`; cards: `rounded-[1.5rem]`
- Use `glass-panel` utility for overlays; `shadow-neon` for shadows
- No `1px solid border` for layout — use surface level shifts instead
- Fonts: `font-headline`/`font-label` = Space Grotesk; `font-body` = Manrope

### Services conventions the Services Worker follows

- All Firestore reads/writes use **Firebase Admin SDK via Server Actions** (`src/app/actions/`)
- Never use Firebase client SDK in components
- All Claude JSON output validated with Zod before use
- Structured logging with winston (`level`, `action`, `timestamp`)
- Never call `getAuth()`, `getDb()`, `getStorage()` at module level — always inside functions
