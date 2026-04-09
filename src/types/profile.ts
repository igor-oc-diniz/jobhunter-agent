import type { Timestamp } from 'firebase/firestore'

export interface Experience {
  id: string
  company: string
  role: string
  startDate: string // "YYYY-MM"
  endDate: string | 'current'
  description: string
  stack: string[]
}

export interface Education {
  id: string
  institution: string
  course: string
  degree: 'graduation' | 'postgrad' | 'mba' | 'bootcamp' | 'technical'
  startDate: string
  endDate: string | 'ongoing'
  status: 'complete' | 'ongoing'
}

export interface TechnicalSkill {
  name: string
  level: 'basic' | 'intermediate' | 'advanced' | 'expert'
}

export interface Language {
  language: string
  level: 'basic' | 'intermediate' | 'advanced' | 'fluent' | 'native'
}

export interface AgentConfig {
  mode: 'automatic' | 'semi-automatic'
  minScore: number
  maxApplicationsPerDay: number
  enabledPlatforms: string[]
  searchKeywords: string[]
  excludeKeywords: string[]
  scheduleHours: number[]
  emailNotifications: boolean
}

export interface UserProfile {
  userId: string
  createdAt: Timestamp
  updatedAt: Timestamp

  personal: {
    fullName: string
    email: string
    phone: string
    city: string
    state: string
    country: string
    linkedinUrl?: string
    githubUrl?: string
    portfolioUrl?: string
  }

  objective: {
    desiredRole: string
    seniority: 'junior' | 'mid' | 'senior' | 'specialist' | 'staff'
    modality: 'remote' | 'hybrid' | 'onsite' | 'any'
    contractType: 'clt' | 'pj' | 'both'
    salaryMin: number
    salaryMax: number
    availabilityDays: number
    professionalSummary: string
  }

  experiences: Experience[]
  education: Education[]

  skills: {
    technical: TechnicalSkill[]
    tools: string[]
    languages: Language[]
    soft: string[]
  }

  agentConfig: AgentConfig
}
