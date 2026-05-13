import { adminDb } from '../firebase-admin'
import logger from './logger'

/**
 * Firestore paths for persisted ATS company lists.
 * Stored under system/ so they are shared across all users.
 */
const GREENHOUSE_DOC = 'system/atsDiscovery/greenhouse/boards'
const LEVER_DOC = 'system/atsDiscovery/lever/slugs'

/**
 * Initial seed lists — used only when Firestore has no data yet.
 * These grow automatically over time as new URLs are discovered.
 */
export const GREENHOUSE_SEED: string[] = [
  'anthropic', 'stripe', 'figma', 'notion', 'linear', 'vercel', 'planetscale',
  'supabase', 'retool', 'airtable', 'brex', 'ramp', 'deel', 'remote', 'gusto',
  'lattice', 'rippling', 'checkr', 'amplitude', 'mixpanel', 'segment', 'contentful',
  'sanity', 'clerk', 'neon', 'resend', 'upstash', 'posthog', 'metabase', 'dbtlabs',
  'airbyte', 'fivetran', 'dagster', 'prefect', 'modal', 'replicate', 'groq',
  'cohere', 'mistral', 'adept', 'together', 'stability',
]

export const LEVER_SEED: string[] = [
  'netflix', 'shopify', 'cloudflare', 'datadog', 'plaid', 'robinhood', 'scale',
  'duolingo', 'discord', 'reddit', 'pinterest', 'lyft', 'instacart', 'doordash',
  'chime', 'coinbase', 'kraken', 'temporal', 'livekit', 'novu', 'inngest',
  'deno', 'storyblok', 'hasura', 'hashicorp',
]

/**
 * Regex patterns to extract company tokens from known ATS URL formats.
 *
 * Greenhouse:
 *   https://boards.greenhouse.io/{token}/jobs/...
 *   https://job-boards.greenhouse.io/{token}/jobs/...
 *   https://boards.eu.greenhouse.io/{token}/jobs/...
 *
 * Lever:
 *   https://jobs.lever.co/{slug}/...
 *   https://jobs.eu.lever.co/{slug}/...
 */
const GREENHOUSE_URL_RE = /https?:\/\/(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/([a-z0-9_-]+)/i
const LEVER_URL_RE = /https?:\/\/jobs(?:\.eu)?\.lever\.co\/([a-z0-9_-]+)/i

export function extractGreenhouseToken(url: string): string | null {
  return url.match(GREENHOUSE_URL_RE)?.[1]?.toLowerCase() ?? null
}

export function extractLeverSlug(url: string): string | null {
  return url.match(LEVER_URL_RE)?.[1]?.toLowerCase() ?? null
}

/**
 * Given a list of job URLs (from any scraper), finds new Greenhouse/Lever
 * company tokens and merges them into the Firestore lists.
 *
 * Returns counts of newly added tokens.
 */
export async function discoverAtsCompanies(
  urls: string[]
): Promise<{ newGreenhouse: number; newLever: number }> {
  const newGreenhouse = new Set<string>()
  const newLever = new Set<string>()

  for (const url of urls) {
    const gh = extractGreenhouseToken(url)
    if (gh) newGreenhouse.add(gh)
    const lv = extractLeverSlug(url)
    if (lv) newLever.add(lv)
  }

  if (newGreenhouse.size === 0 && newLever.size === 0) {
    return { newGreenhouse: 0, newLever: 0 }
  }

  const [ghDoc, lvDoc] = await Promise.all([
    adminDb.doc(GREENHOUSE_DOC).get(),
    adminDb.doc(LEVER_DOC).get(),
  ])

  const existingGh = new Set<string>(ghDoc.data()?.tokens ?? GREENHOUSE_SEED)
  const existingLv = new Set<string>(lvDoc.data()?.slugs ?? LEVER_SEED)

  const addedGh = [...newGreenhouse].filter((t) => !existingGh.has(t))
  const addedLv = [...newLever].filter((s) => !existingLv.has(s))

  const writes: Promise<unknown>[] = []

  if (addedGh.length > 0) {
    addedGh.forEach((t) => existingGh.add(t))
    writes.push(
      adminDb.doc(GREENHOUSE_DOC).set(
        { tokens: [...existingGh], updatedAt: new Date().toISOString() },
        { merge: true }
      )
    )
    logger.info('ats_discovery_greenhouse', { added: addedGh })
  }

  if (addedLv.length > 0) {
    addedLv.forEach((s) => existingLv.add(s))
    writes.push(
      adminDb.doc(LEVER_DOC).set(
        { slugs: [...existingLv], updatedAt: new Date().toISOString() },
        { merge: true }
      )
    )
    logger.info('ats_discovery_lever', { added: addedLv })
  }

  await Promise.all(writes)

  return { newGreenhouse: addedGh.length, newLever: addedLv.length }
}

/**
 * Returns the current Greenhouse board tokens from Firestore.
 * Falls back to the seed list if nothing is stored yet.
 */
export async function getGreenhouseBoards(): Promise<string[]> {
  const doc = await adminDb.doc(GREENHOUSE_DOC).get()
  const tokens: string[] = doc.data()?.tokens ?? []
  if (tokens.length > 0) return tokens

  // Persist seeds on first run so Firestore reflects the current list
  await adminDb.doc(GREENHOUSE_DOC).set(
    { tokens: GREENHOUSE_SEED, updatedAt: new Date().toISOString() },
    { merge: true }
  )
  return GREENHOUSE_SEED
}

/**
 * Returns the current Lever company slugs from Firestore.
 * Falls back to the seed list if nothing is stored yet.
 */
export async function getLeverSlugs(): Promise<string[]> {
  const doc = await adminDb.doc(LEVER_DOC).get()
  const slugs: string[] = doc.data()?.slugs ?? []
  if (slugs.length > 0) return slugs

  // Persist seeds on first run so Firestore reflects the current list
  await adminDb.doc(LEVER_DOC).set(
    { slugs: LEVER_SEED, updatedAt: new Date().toISOString() },
    { merge: true }
  )
  return LEVER_SEED
}
