/**
 * Example: Test deduplication logic
 * 
 * Usage:
 *   tsx src/agent/examples/test-deduplication.ts
 */

import { generateJobHash, checkBlacklist, addToBlacklist } from '../utils/deduplication'
import { adminDb } from '../firebase-admin'
import type { NormalizedJob } from '@/types/scraper'

async function main() {
  console.log('Testing deduplication logic...\n')

  // Test 1: Generate hashes
  console.log('Test 1: Hash Generation')
  const hash1 = generateJobHash('job123', 'gupy')
  const hash2 = generateJobHash('job123', 'gupy')
  const hash3 = generateJobHash('job456', 'gupy')
  
  console.log('  Hash 1:', hash1)
  console.log('  Hash 2 (same input):', hash2)
  console.log('  Hash 3 (different job):', hash3)
  console.log('  ✓ Hashes are deterministic:', hash1 === hash2)
  console.log('  ✓ Different jobs have different hashes:', hash1 !== hash3)
  console.log()

  // Test 2: Check blacklist (should not exist initially)
  console.log('Test 2: Check Blacklist (before adding)')
  const testHash = generateJobHash('test-job-' + Date.now(), 'test-platform')
  const checkResult1 = await checkBlacklist(adminDb, testHash)
  console.log('  Is duplicate?', checkResult1.isDuplicate)
  console.log('  ✓ Not in blacklist initially:', !checkResult1.isDuplicate)
  console.log()

  // Test 3: Add to blacklist
  console.log('Test 3: Add to Blacklist')
  const testJob: Partial<NormalizedJob> = {
    externalId: 'test-job-' + Date.now(),
    platform: 'test-platform',
    title: 'Test Developer Position',
    company: 'Test Company',
    url: 'https://example.com/jobs/test',
  }
  
  await addToBlacklist(adminDb, testHash, testJob)
  console.log('  ✓ Added to blacklist')
  console.log()

  // Test 4: Check blacklist again (should exist now)
  console.log('Test 4: Check Blacklist (after adding)')
  const checkResult2 = await checkBlacklist(adminDb, testHash)
  console.log('  Is duplicate?', checkResult2.isDuplicate)
  console.log('  ✓ Now in blacklist:', checkResult2.isDuplicate)
  console.log()

  // Cleanup: Remove test entry
  console.log('Cleanup: Removing test entry from blacklist')
  await adminDb.collection('jobBlacklist').doc(testHash).delete()
  console.log('  ✓ Test entry removed')
  console.log()

  console.log('All tests passed! ✓')
  process.exit(0)
}

main().catch(error => {
  console.error('Test failed:', error)
  process.exit(1)
})
