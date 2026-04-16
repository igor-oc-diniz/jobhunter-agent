# CLAUDE.md

Autonomous job application agent: scrapes jobs → semantic matching → personalized CV + cover letter → form filling → real-time dashboard.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Node.js 20+, TypeScript strict |
| LLM | Claude API (`claude-sonnet-4-5`) |
| Browser automation | Playwright + `playwright-extra` + stealth plugin |
| HTTP scraping | Axios + Cheerio |
| PDF generation | Puppeteer → Handlebars HTML → A4 PDF |
| Job queue | BullMQ + Redis (Upstash) |
| Logger | Winston (structured JSON) |
| Frontend | Next.js 14 App Router, Tailwind, shadcn/ui |
| State / data | Zustand, React Query, Firestore SDK |
| Database | Firebase Firestore + Storage + Auth |
| Email | Resend |

---

## File Structure

```
src/
  app/
    (auth)/login/           → Google sign-in
    (dashboard)/            → layout with sidebar + topbar
      applications/         → Kanban board
      applications/[jobId]/ → Application detail
      analytics/            → Charts
      profile/setup/        → Multi-step wizard
      agent/                → Agent status + logs
      settings/             → Agent config
    actions/                → ALL Firestore reads/writes (Admin SDK only)
    api/auth/session/       → POST/DELETE session cookie
  agent/
    pipeline.ts             → Main pipeline: scrape → match → CV → cover letter
    matching/matcher.ts     → Weighted score + Claude analysis
    scrapers/               → One file per platform
    cv/cv-generator.ts      → Claude → Handlebars → Puppeteer → Storage
    cover-letter/           → Claude, auto-detects tone + language
    form-filler/            → Playwright + Claude (Module 06 — not started)
  types/                    → All TypeScript types (profile, job, application, agent)
  components/
    design-system/          → Atoms, molecules (StatusBeacon, StatCard, etc.)
    dashboard/              → Organisms (KanbanBoard, AgentPanel, etc.)
    profile/                → Multi-step wizard components
```

---

## Firestore Structure

```
users/{userId}/
  profile/data              → UserProfile (includes agentConfig)
  rawJobs/{jobId}/          → RawJob (status: pending→matched/rejected)
  applications/{jobId}/     → Application (cvUrl, coverLetterText, status, stages[])
  applicationQueue/{jobId}/ → ApplicationQueueItem
  blacklist/{entryId}/      → BlacklistEntry (never reprocess)
  agentStatus/current       → { status, lastRunAt, currentJob, updatedAt }
  agentLogs/{runId}/        → AgentRunLog { entries[], applicationsProcessed, errors }
  notifications/{notifId}/  → Notification
system/platformStatus/{platform}/ → write via Admin SDK only
```

**Critical**: blacklisted URLs are never reprocessed. `AgentConfig` is nested inside `UserProfile.agentConfig`.

---

## Design System — Neon Command

Read `docs/designsystem/` before creating any UI component.

- **Background**: `bg-background` (#131313) — never `bg-black`
- **Primary**: `primary-container` (#00ff88); **secondary**: `secondary-container` (#00e0ff)
- **Surfaces** (dark→light): `surface-container-lowest` → `low` → `surface-container` → `high` → `highest`
- **No borders for layout** — use surface level shifts instead
- **Rounding**: min `rounded-[1rem]`; cards `rounded-[1.5rem]`; modals `rounded-[2rem]`
- **Glass**: `glass-panel` utility; **shadows**: `shadow-neon` only
- **Fonts**: `font-headline`/`font-label` = Space Grotesk; `font-body` = Manrope
- **Hover cards**: `hover:scale-[1.02] hover:border-primary-container/20 hover:shadow-neon`
- **Section headers**: `text-[10px] font-label uppercase tracking-widest text-outline`
- **Atoms**: `src/components/design-system/atoms/` — `StatusBeacon`, `StatusBadge`, `ScoreBadge`, `Chip`
- **Molecules**: `src/components/design-system/molecules/` — `StatCard`, `NotificationItem`

---

## Code Conventions

- **Language**: English everywhere (code, UI, comments, errors)
- **Files**: kebab-case
- **Async**: always explicit `try/catch` with logger
- **Logs**: structured JSON `{ level, action, timestamp }` — never log credentials
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- **TypeScript**: strict, no implicit `any`
- **Claude JSON**: always validate with Zod before using
- **Firebase client**: never call `getAuth()` / `getDb()` / `getStorage()` at module level

---

## Critical Patterns

**Server Actions (dashboard)**: All Firestore reads/writes use Firebase Admin SDK via `src/app/actions/`. Never use the client SDK in components.

**Firestore index pitfall**: `where()` + `orderBy()` on different fields requires a composite index. When filtering by `read == false`, drop `orderBy` and sort in memory instead.

**Form Filler — never auto-fill**: CPF/CNPJ, bank details, passwords, document numbers, health info. Always pause and notify user.

**Scraper isolation**: all scrapers extend `BaseScraper`. One platform failure never stops others. CAPTCHA detected → pause + notify, never bypass.

**Firebase client** (`src/lib/firebase/client.ts`): lazy singleton — SSR-safe during Next.js build.

---

## Current State (2026-04-16)

**Branch**: `develop`

**Done**: Design system, Auth, Dashboard (Kanban, Analytics, Agent panel, Settings, Notifications), Profile wizard + CV import, Agent HTTP server, Pipeline (scrape → match → CV → cover letter), 9 scrapers (Remotive, Indeed BR/CA/AU, WeWorkRemotely, Himalayas, Wellfound, RemoteOK, Arbeitnow).

**Next**: Form Filler (Module 06) → Deploy Fly.io → Firestore security rules.

**Known issues**: `HimalayadScraper` typo (double `d`); agent health shows `degraded` locally (expected — tsx RAM); never add inline comments after `.env.local` values.

---

## Dev Agent

`dev-agents/` builds features via two parallel workers (Design + Services). **Use it for new components, pages, or server actions. Don't use it for bug fixes or config changes.**

```bash
npm run dev-agent "Feature description in English"
```

Workers follow the same conventions above: Admin SDK only, Zod validation, Neon Command design system, Winston logs.
