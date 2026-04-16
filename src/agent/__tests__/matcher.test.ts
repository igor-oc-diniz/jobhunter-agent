import { vi, describe, it, expect } from 'vitest'

vi.mock('../firebase-admin', () => ({ adminDb: {} }))
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => null } }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class {} }))

import { calculateScoreBreakdown } from '../matching/matcher'
import type { RawJob, UserProfile } from '@/types'
import type { Timestamp } from 'firebase-admin/firestore'

const baseJob: RawJob = {
  id: 'job-1',
  userId: 'user-1',
  title: 'Senior Frontend Developer',
  company: 'Acme Corp',
  location: 'São Paulo',
  isRemote: true,
  description: 'Build modern web applications',
  techStack: ['react', 'typescript', 'tailwindcss'],
  sourceUrl: 'https://example.com/job/1',
  sourcePlatform: 'gupy',
  scrapedAt: {} as Timestamp,
  status: 'pending',
  contractType: 'pj',
  salaryMin: 8000,
  salaryMax: 12000,
}

const baseProfile: UserProfile = {
  userId: 'user-1',
  createdAt: {} as Timestamp,
  updatedAt: {} as Timestamp,
  personal: {
    fullName: 'Test User',
    email: 'user@example.com',
    phone: '',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
  },
  objective: {
    desiredRole: 'Frontend Developer',
    seniority: 'senior',
    contractType: 'pj',
    modality: 'remote',
    salaryMin: 8000,
    salaryMax: 15000,
    availabilityDays: 30,
    professionalSummary: 'Experienced frontend developer',
  },
  skills: {
    technical: [
      { name: 'React', level: 'advanced' },
      { name: 'TypeScript', level: 'advanced' },
      { name: 'TailwindCSS', level: 'intermediate' },
    ],
    tools: [],
    soft: [],
    languages: [],
  },
  experiences: [],
  education: [],
  agentConfig: {
    mode: 'semi-automatic',
    minScore: 70,
    maxApplicationsPerDay: 10,
    enabledPlatforms: ['gupy'],
    searchKeywords: [],
    excludeKeywords: [],
    scheduleHours: [9],
    emailNotifications: false,
  },
}

const baseClaude = {
  semanticScore: 80,
  seniorityMatch: 'match' as const,
  positives: ['Good stack match'],
  gaps: [],
  cvAdaptations: [],
  redFlags: [],
  justification: 'Strong match.',
  recommended: true,
}

describe('calculateScoreBreakdown', () => {
  it('returns 100 stackOverlap when all job techs are in profile', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.stackOverlap).toBe(100)
  })

  it('returns partial stackOverlap when only some techs match', () => {
    const job = { ...baseJob, techStack: ['react', 'typescript', 'java', 'spring'] }
    const result = calculateScoreBreakdown(job, baseProfile, baseClaude)
    // 2 out of 4 match = 50%
    expect(result.stackOverlap).toBe(50)
  })

  it('returns 50 stackOverlap when job has no tech stack', () => {
    const job = { ...baseJob, techStack: [] }
    const result = calculateScoreBreakdown(job, baseProfile, baseClaude)
    expect(result.stackOverlap).toBe(50)
  })

  it('returns 100 seniorityScore for match', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.seniorityScore).toBe(100)
  })

  it('returns 40 seniorityScore for under', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, { ...baseClaude, seniorityMatch: 'under' })
    expect(result.seniorityScore).toBe(40)
  })

  it('returns 60 seniorityScore for over', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, { ...baseClaude, seniorityMatch: 'over' })
    expect(result.seniorityScore).toBe(60)
  })

  it('returns 100 contractScore when contract types match', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.contractScore).toBe(100)
  })

  it('returns 0 contractScore when contract types mismatch', () => {
    const job = { ...baseJob, contractType: 'clt' as const }
    const result = calculateScoreBreakdown(job, baseProfile, baseClaude)
    expect(result.contractScore).toBe(0)
  })

  it('returns 100 contractScore when profile wants both', () => {
    const profile = { ...baseProfile, objective: { ...baseProfile.objective, contractType: 'both' as const } }
    const job = { ...baseJob, contractType: 'clt' as const }
    const result = calculateScoreBreakdown(job, profile, baseClaude)
    expect(result.contractScore).toBe(100)
  })

  it('returns 100 contractScore when job contractType is unknown', () => {
    const job = { ...baseJob, contractType: 'unknown' as const }
    const result = calculateScoreBreakdown(job, baseProfile, baseClaude)
    expect(result.contractScore).toBe(100)
  })

  it('returns 100 modalityScore when job is remote and profile wants remote', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.modalityScore).toBe(100)
  })

  it('returns 20 modalityScore when job is remote but profile wants onsite', () => {
    const profile = { ...baseProfile, objective: { ...baseProfile.objective, modality: 'onsite' as const } }
    const result = calculateScoreBreakdown(baseJob, profile, baseClaude)
    expect(result.modalityScore).toBe(20)
  })

  it('returns 100 salaryScore when job salary meets expectation', () => {
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.salaryScore).toBe(100) // job.salaryMax=12000 >= profile.salaryMin=8000
  })

  it('returns 0 salaryScore when job salary is below expectation', () => {
    const profile = { ...baseProfile, objective: { ...baseProfile.objective, salaryMin: 15000 } }
    const result = calculateScoreBreakdown(baseJob, profile, baseClaude)
    expect(result.salaryScore).toBe(0) // job.salaryMax=12000 < profile.salaryMin=15000
  })

  it('returns 50 salaryScore when job has no salary info', () => {
    const job = { ...baseJob, salaryMin: undefined, salaryMax: undefined }
    const result = calculateScoreBreakdown(job, baseProfile, baseClaude)
    expect(result.salaryScore).toBe(50)
  })

  it('calculates a weighted finalScore correctly', () => {
    // stack=100, seniority=100, contract=100, modality=100, salary=100, semantic=80
    // 100*0.35 + 100*0.20 + 100*0.15 + 100*0.10 + 100*0.10 + 80*0.10 = 98
    const result = calculateScoreBreakdown(baseJob, baseProfile, baseClaude)
    expect(result.finalScore).toBe(98)
  })
})
