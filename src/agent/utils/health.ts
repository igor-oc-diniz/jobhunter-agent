import * as http from 'http'
import { adminDb } from '../firebase-admin'
import { createLogger } from './logger'

const logger = createLogger('health-check')

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    firestore: boolean
    memory: boolean
  }
  error?: string
}

/**
 * Check if Firestore connection is healthy
 */
async function checkFirestore(): Promise<boolean> {
  try {
    // Try to read from a test collection
    await adminDb.collection('_health').limit(1).get()
    return true
  } catch (error) {
    logger.error('Firestore health check failed', { error })
    return false
  }
}

/**
 * Check if memory usage is within acceptable limits
 */
function checkMemory(): boolean {
  const usage = process.memoryUsage()
  const heapUsedMB = usage.heapUsed / 1024 / 1024
  const heapTotalMB = usage.heapTotal / 1024 / 1024
  
  // Alert if using more than 80% of heap
  const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100
  
  logger.debug('Memory usage', {
    heapUsedMB: heapUsedMB.toFixed(2),
    heapTotalMB: heapTotalMB.toFixed(2),
    heapUsagePercent: heapUsagePercent.toFixed(2),
  })
  
  return heapUsagePercent < 80
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const startTime = Date.now()
  
  try {
    const [firestoreHealthy, memoryHealthy] = await Promise.all([
      checkFirestore(),
      Promise.resolve(checkMemory()),
    ])

    const allHealthy = firestoreHealthy && memoryHealthy
    const anyHealthy = firestoreHealthy || memoryHealthy

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (allHealthy) {
      status = 'healthy'
    } else if (anyHealthy) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        firestore: firestoreHealthy,
        memory: memoryHealthy,
      },
    }
  } catch (error) {
    logger.error('Health check failed', { error })
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        firestore: false,
        memory: false,
      },
      error: (error as Error).message,
    }
  }
}

/**
 * Start HTTP server for health checks
 * Useful for container orchestration (Railway, Fly.io, Kubernetes)
 */
export function startHealthServer(port: number = 3001): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const health = await getHealthStatus()
      
      // Set status code based on health
      let statusCode = 200
      if (health.status === 'degraded') {
        statusCode = 200 // Still OK for degraded
      } else if (health.status === 'unhealthy') {
        statusCode = 503 // Service unavailable
      }
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(health, null, 2))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.listen(port, () => {
    logger.info('Health check server started', { port })
  })

  return server
}
