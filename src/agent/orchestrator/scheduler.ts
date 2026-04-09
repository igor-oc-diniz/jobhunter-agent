import cron from 'node-cron'
import { adminDb } from '../firebase-admin'
import { runAgentCycle } from './orchestrator'
import { logger } from '../utils/logger'
import type { UserProfile } from '@/types'

// Track running cycles to prevent overlap
const runningUsers = new Set<string>()

async function getAllActiveUsers(): Promise<{ id: string; profile: UserProfile }[]> {
  const snap = await adminDb.collectionGroup('profile').get()
  return snap.docs
    .filter((d) => d.id === 'data')
    .map((d) => ({
      id: d.ref.parent.parent!.id,
      profile: d.data() as UserProfile,
    }))
}

// Check every hour which users have this hour in their scheduleHours
cron.schedule('0 * * * *', async () => {
  const currentHour = new Date().getHours()
  logger.info('scheduler_tick', { hour: currentHour })

  let users: Awaited<ReturnType<typeof getAllActiveUsers>>
  try {
    users = await getAllActiveUsers()
  } catch (err) {
    logger.error('scheduler_load_users_error', { error: String(err) })
    return
  }

  for (const { id, profile } of users) {
    if (!profile.agentConfig?.scheduleHours?.includes(currentHour)) continue
    if (runningUsers.has(id)) {
      logger.warn('cycle_already_running', { userId: id })
      continue
    }

    runningUsers.add(id)
    runAgentCycle(id)
      .catch((err) => logger.error('cycle_error', { userId: id, error: String(err) }))
      .finally(() => runningUsers.delete(id))
  }
})

// Interview reminders — daily at 8am
cron.schedule('0 8 * * *', async () => {
  logger.info('interview_reminder_check')
  // Implemented in notifications module
})

logger.info('scheduler_started')
