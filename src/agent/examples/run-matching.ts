/**
 * Standalone script to test the semantic matching module.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT='...' USER_ID='uid123' tsx src/agent/examples/run-matching.ts
 */
import { adminDb } from '../firebase-admin'
import { runMatching } from '../matching/matcher'
import { createLogger } from '../utils/logger'
import type { UserProfile } from '@/types'

const logger = createLogger('example:run-matching')

async function main() {
  const userId = process.env.USER_ID
  if (!userId) {
    logger.error('missing_user_id', { hint: 'Set USER_ID environment variable' })
    process.exit(1)
  }

  const snap = await adminDb.doc(`users/${userId}/profile/data`).get()
  if (!snap.exists) {
    logger.error('profile_not_found', { userId })
    process.exit(1)
  }

  const profile = snap.data() as UserProfile
  logger.info('starting_matching', { userId, name: profile.personal.fullName })

  await runMatching(userId, profile)

  // Print summary
  const matched = await adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'matched').get()
  const rejected = await adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'rejected').get()
  const queued = await adminDb.collection(`users/${userId}/applicationQueue`).where('status', '==', 'queued').get()

  logger.info('matching_complete', {
    userId,
    matched: matched.size,
    rejected: rejected.size,
    queued: queued.size,
  })

  console.log(`\n✅ Matching complete`)
  console.log(`   Matched:  ${matched.size} jobs`)
  console.log(`   Rejected: ${rejected.size} jobs`)
  console.log(`   Queued:   ${queued.size} jobs pending application`)
}

main().catch((err) => {
  logger.error('run_matching_failed', { error: String(err) })
  process.exit(1)
})
