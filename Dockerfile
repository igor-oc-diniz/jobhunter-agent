# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.agent.json ./
COPY src/ ./src/

RUN npx tsc -p tsconfig.agent.json

# ── Stage 2: Production ─────────────────────────────────────────────────────
# Uses the official Playwright image so Chromium + system deps are pre-installed
FROM mcr.microsoft.com/playwright:v1.59.0-noble AS runner

WORKDIR /app

# Production Node deps only
COPY package*.json ./
RUN npm ci --only=production

# Compiled agent
COPY --from=builder /app/dist ./dist


ENV NODE_ENV=production
ENV PORT=3001
# Tell Playwright/Puppeteer to use the pre-installed browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3001

CMD ["node", "dist/agent/index.js"]
