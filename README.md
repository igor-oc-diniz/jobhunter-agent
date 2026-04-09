# jobhunter-agent

An AI-powered job application agent that searches for compatible job openings, generates personalized resumes and cover letters for each position, auto-fills application forms, and tracks your entire hiring pipeline through an interactive dashboard. Built with Claude AI, Next.js and Firebase.

## Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **AI**: Claude API (`claude-sonnet-4-5`) — matching, CV generation, form filling, orchestration
- **Database**: Firebase Firestore + Firebase Storage
- **Auth**: Firebase Auth (Google OAuth)
- **Agent**: Node.js, Playwright, BullMQ + Redis (Upstash), node-cron
- **Deploy**: Vercel (dashboard) + Railway/Fly.io (agent)

## Getting Started

Copy the environment file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.local.example` for the full list. Required keys:

- `ANTHROPIC_API_KEY` — Claude API
- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config
- `FIREBASE_*` — Firebase Admin SDK (backend/agent)
- `REDIS_URL` / `REDIS_TOKEN` — Upstash Redis
- `RESEND_API_KEY` — transactional email
