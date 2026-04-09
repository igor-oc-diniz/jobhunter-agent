import type { Timestamp } from 'firebase/firestore'

export type ApplicationStatus =
  | 'queued'
  | 'processing'
  | 'awaiting_confirmation'
  | 'applied'
  | 'viewed'
  | 'screening'
  | 'interview_hr'
  | 'interview_tech'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'
  | 'failed'

export interface ApplicationStage {
  name: string
  date: string
  notes?: string
}

export interface Application {
  jobId: string
  userId: string

  jobSnapshot: {
    title: string
    company: string
    location: string
    isRemote: boolean
    techStack: string[]
    salaryMin?: number
    salaryMax?: number
    contractType?: string
    sourceUrl: string
    sourcePlatform: string
  }

  status: ApplicationStatus
  appliedAt?: Timestamp
  matchScore: number

  cvUrl?: string
  cvGeneratedAt?: Timestamp
  coverLetterText?: string
  coverLetterGeneratedAt?: Timestamp

  formFilledAt?: Timestamp
  formScreenshotUrl?: string
  confirmationText?: string
  awaitingConfirmationSince?: Timestamp

  currentStage?: string
  stages: ApplicationStage[]
  notes?: string
  recruiterName?: string
  recruiterContact?: string
  offerValue?: number

  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ApplicationQueueItem {
  jobId: string
  priority: number
  matchScore: number
  status: 'queued' | 'processing' | 'done' | 'failed'
  createdAt: Timestamp
}
