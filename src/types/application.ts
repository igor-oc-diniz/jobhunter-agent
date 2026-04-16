import type { Timestamp } from 'firebase/firestore'

/** Dates come as Firestore Timestamp when read via client SDK, or ISO string when serialized via server actions */
export type FirestoreDate = Timestamp | string

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
  appliedAt?: FirestoreDate
  matchScore: number

  cvUrl?: string
  cvGeneratedAt?: FirestoreDate
  coverLetterText?: string
  coverLetterGeneratedAt?: FirestoreDate

  formFilledAt?: FirestoreDate
  formScreenshotUrl?: string
  confirmationText?: string
  awaitingConfirmationSince?: FirestoreDate

  currentStage?: string
  stages: ApplicationStage[]
  notes?: string
  recruiterName?: string
  recruiterContact?: string
  offerValue?: number

  createdAt: FirestoreDate
  updatedAt: FirestoreDate
}

export interface ApplicationQueueItem {
  jobId: string
  priority: number
  matchScore: number
  status: 'queued' | 'processing' | 'done' | 'failed'
  createdAt: Timestamp
}
