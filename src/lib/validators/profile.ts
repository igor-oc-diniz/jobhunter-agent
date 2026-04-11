import { z } from 'zod'

export const personalSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().min(8, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  linkedinUrl: z
    .string()
    .url('Invalid URL')
    .refine((v) => v.includes('linkedin.com'), 'Must be a LinkedIn URL')
    .optional()
    .or(z.literal('')),
  githubUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  portfolioUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
})

export const objectiveSchema = z
  .object({
    desiredRole: z.string().min(2, 'Desired role is required'),
    seniority: z.enum(['junior', 'mid', 'senior', 'specialist', 'staff']),
    modality: z.enum(['remote', 'hybrid', 'onsite', 'any']),
    contractType: z.enum(['clt', 'pj', 'both']),
    salaryMin: z.number().min(0),
    salaryMax: z.number().min(0),
    availabilityDays: z.number().min(0),
    professionalSummary: z.string().min(10, 'Summary must be at least 10 characters'),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, {
    message: 'Max salary must be greater than or equal to min salary',
    path: ['salaryMax'],
  })

export const experienceSchema = z.object({
  id: z.string(),
  company: z.string().min(1, 'Company is required'),
  role: z.string().min(1, 'Role is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  description: z.string().min(10, 'Description is required'),
  stack: z.array(z.string()),
})

export const educationSchema = z.object({
  id: z.string(),
  institution: z.string().min(1, 'Institution is required'),
  course: z.string().min(1, 'Course is required'),
  degree: z.enum(['graduation', 'postgrad', 'mba', 'bootcamp', 'technical']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string(),
  status: z.enum(['complete', 'ongoing']),
})

export const agentConfigSchema = z.object({
  mode: z.enum(['automatic', 'semi-automatic']),
  minScore: z.number().min(0).max(100),
  maxApplicationsPerDay: z.number().min(1).max(50),
  enabledPlatforms: z.array(z.string()).min(1, 'Select at least one platform'),
  searchKeywords: z.array(z.string()),
  excludeKeywords: z.array(z.string()),
  scheduleHours: z.array(z.number()),
  emailNotifications: z.boolean(),
})

export type PersonalFormValues = z.infer<typeof personalSchema>
export type ObjectiveFormValues = z.infer<typeof objectiveSchema>
export type ExperienceFormValues = z.infer<typeof experienceSchema>
export type EducationFormValues = z.infer<typeof educationSchema>
export type AgentConfigFormValues = z.infer<typeof agentConfigSchema>
