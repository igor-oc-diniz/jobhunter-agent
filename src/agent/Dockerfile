# Multi-stage build for Node.js agent container
FROM node:20-alpine AS base

# Install dependencies for Playwright
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.cache /root/.cache

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 agent
RUN chown -R agent:nodejs /app

USER agent

EXPOSE 3001

# Start the agent
CMD ["npm", "run", "agent:start"]
