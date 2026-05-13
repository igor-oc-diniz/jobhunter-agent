import type { Timestamp } from 'firebase/firestore'

export interface DescriptionSections {
  aboutCompany: string
  jobActivities: string
  cultural: string
}

export interface RawJob {
  id: string
  userId: string

  title: string
  company: string
  location: string
  isRemote: boolean
  description: string
  /** Indicates whether the description came from the full job page or just the listing snippet */
  descriptionSource: 'full_page' | 'snippet'
  /** True when no description could be extracted at all */
  descriptionMissing?: boolean
  descriptionSections?: DescriptionSections
  requirements?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  contractType?: 'clt' | 'pj' | 'both' | 'unknown'
  publishedAt?: string
  techStack: string[]

  sourceUrl: string
  sourcePlatform: string
  scrapedAt: Timestamp
  /** Timestamp of when the individual job page was accessed (Phase 2) */
  fullPageAccessedAt?: Timestamp

  /** Whether this listing passed the local pre-filter (Phase 1) */
  preFilterPassed: boolean
  /** Reason for pre-filter rejection, when applicable */
  preFilterReason?: string

  status: 'pending' | 'matched' | 'rejected' | 'applied' | 'error'
  matchScore?: number
  matchDetails?: MatchDetails
  errorMessage?: string
}

export interface MatchDetails {
  stackOverlap: number
  seniorityScore: number
  contractScore: number
  modalityScore: number
  salaryScore: number
  semanticScore: number

  positives: string[]
  gaps: string[]
  cvAdaptations: string[]
  redFlags: string[]

  justification: string
  matchedAt: Timestamp
  manuallyApproved?: boolean
}

export interface BlacklistEntry {
  sourceUrl: string
  company: string
  title: string
  addedAt: Timestamp
  reason: 'applied' | 'user_rejected' | 'score_too_low' | 'error' | 'red_flag' | 'manually_archived' | 'pre_filter'
}
