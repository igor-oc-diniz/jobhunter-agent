import express from 'express'
import { runPipeline } from './pipeline'
import { createLogger } from './utils/logger'

const logger = createLogger('http-server')

export function createServer() {
  const app = express()
  app.use(express.json())

  // Auth middleware — shared secret between dashboard and agent
  app.use((req, res, next) => {
    const secret = process.env.AGENT_SECRET
    if (!secret) return next() // skip in dev if not set
    if (req.headers['x-agent-secret'] !== secret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  app.post('/run', async (req, res) => {
    const { userId } = req.body as { userId?: string }

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' })
      return
    }

    logger.info('run_triggered', { userId })

    // Respond immediately — pipeline runs in background
    res.json({ ok: true, message: 'Pipeline started' })

    runPipeline(userId).catch((err) => {
      logger.error('pipeline_error', { userId, error: String(err) })
    })
  })

  return app
}

export function startServer(port: number) {
  const app = createServer()
  app.listen(port, () => {
    logger.info('http_server_started', { port })
  })
  return app
}
