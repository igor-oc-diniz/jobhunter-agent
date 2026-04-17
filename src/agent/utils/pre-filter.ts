import type { UserProfile } from '@/types'
import { extractTechStack } from './tech-extractor'

/**
 * Minimal shape of a job listing as returned by Phase 1 scraping.
 * Scrapers will eventually implement the full JobListing interface from the doc;
 * this type covers the fields required by the pre-filter logic.
 */
export interface JobListing {
  url: string
  title: string
  company: string
  location: string
  isRemote: boolean
  snippet: string
  salaryRaw?: string
  publishedAt?: string
  contractTypeRaw?: string
  sourcePlatform: string
}

interface RejectedListing {
  listing: JobListing
  reason: string
}

export interface PreFilterResult {
  approved: JobListing[]
  rejected: RejectedListing[]
}

/**
 * Parses a raw salary string and returns { min, max } in numeric form.
 * Handles formats like "R$ 3.000 - R$ 5.000", "3000-5000", "$80k - $100k".
 * Returns null when parsing is not possible (e.g. "a combinar").
 */
function parseSalary(raw: string): { min: number; max: number } | null {
  // Strip currency symbols and dots used as thousand separators, then extract numbers
  const normalized = raw.replace(/[R$€£¥,\.]/g, ' ').replace(/k\b/gi, '000')
  const nums = normalized
    .split(/[\s\-–]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n > 0)

  if (nums.length === 0) return null
  if (nums.length === 1) return { min: nums[0], max: nums[0] }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/**
 * Returns the rejection reason string, or null if the listing should be approved.
 */
function getRejectReason(listing: JobListing, profile: UserProfile): string | null {
  const titleLower = listing.title.toLowerCase()
  const snippetLower = listing.snippet.toLowerCase()
  const companyLower = listing.company.toLowerCase()

  // 1. Exclude by keyword (title or company)
  for (const kw of profile.agentConfig.excludeKeywords) {
    const kwLower = kw.toLowerCase()
    if (titleLower.includes(kwLower) || companyLower.includes(kwLower)) {
      return `exclude_keyword:${kw}`
    }
  }

  // 2. No search keyword or stack overlap in title/snippet
  const searchKws = [
    ...profile.agentConfig.searchKeywords,
    profile.objective.desiredRole,
  ].map((k) => k.toLowerCase())

  const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())

  const hasKeywordMatch = searchKws.some(
    (kw) => titleLower.includes(kw) || snippetLower.includes(kw)
  )

  const snippetStack = extractTechStack(listing.snippet).map((t) => t.toLowerCase())
  const hasStackOverlap = snippetStack.some((t) => userStack.includes(t))

  if (!hasKeywordMatch && !hasStackOverlap) {
    return 'no_keyword_or_stack_match'
  }

  return null
}

/**
 * Applies local pre-filter to a batch of listings.
 * No Claude calls — purely rule-based, zero token cost.
 *
 * Approved listings proceed to Phase 2 (full page scraping).
 * Rejected listings should be added to the blacklist with reason 'pre_filter'.
 */
export function runPreFilter(listings: JobListing[], profile: UserProfile): PreFilterResult {
  const approved: JobListing[] = []
  const rejected: RejectedListing[] = []

  for (const listing of listings) {
    const reason = getRejectReason(listing, profile)
    if (reason) {
      rejected.push({ listing, reason })
    } else {
      approved.push(listing)
    }
  }

  return { approved, rejected }
}
