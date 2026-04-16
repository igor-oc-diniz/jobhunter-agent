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
}

export interface BlacklistEntry {
  sourceUrl: string
  company: string
  title: string
  addedAt: Timestamp
  reason: 'applied' | 'user_rejected' | 'score_too_low' | 'error' | 'red_flag'
}
