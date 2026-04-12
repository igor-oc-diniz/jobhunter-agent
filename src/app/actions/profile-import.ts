'use server'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { requireUserId } from '@/lib/auth/server'
import type { UserProfile } from '@/types'

const client = new Anthropic()

// ---------------------------------------------------------------------------
// Zod schema for the partial profile Claude returns
// Lenient: accepts common field name variations Claude tends to use
// ---------------------------------------------------------------------------

// Normalize raw experience objects — Claude may use position/title/role,
// responsibilities/summary/description, technologies/tech_stack/stack, etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeExperience(raw: any, idx: number) {
  return {
    id: raw.id ?? `exp-${idx + 1}`,
    company: raw.company ?? raw.organization ?? '',
    role: raw.role ?? raw.position ?? raw.title ?? raw.job_title ?? '',
    startDate: raw.startDate ?? raw.start_date ?? raw.start ?? '',
    endDate: raw.endDate ?? raw.end_date ?? raw.end ?? 'current',
    description: raw.description ?? raw.responsibilities ?? raw.summary ?? raw.details ?? '',
    stack: raw.stack ?? raw.technologies ?? raw.tech_stack ?? raw.skills ?? [],
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEducation(raw: any, idx: number) {
  const statusRaw = (raw.status ?? '').toLowerCase()
  const status = statusRaw === 'complete' || statusRaw === 'completed' || statusRaw === 'finished'
    ? 'complete'
    : statusRaw === 'ongoing' || statusRaw === 'in progress' || statusRaw === 'current'
    ? 'ongoing'
    : raw.endDate === 'ongoing' || raw.end_date === 'ongoing'
    ? 'ongoing'
    : 'complete'

  return {
    id: raw.id ?? `edu-${idx + 1}`,
    institution: raw.institution ?? raw.school ?? raw.university ?? raw.college ?? '',
    course: raw.course ?? raw.field ?? raw.field_of_study ?? raw.major ?? raw.program ?? '',
    degree: raw.degree ?? 'graduation',
    startDate: raw.startDate ?? raw.start_date ?? raw.start ?? '',
    endDate: raw.endDate ?? raw.end_date ?? raw.end ?? 'ongoing',
    status,
  }
}

const importedProfileSchema = z.object({
  personal: z
    .object({
      fullName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      linkedinUrl: z.string().optional(),
      githubUrl: z.string().optional(),
      portfolioUrl: z.string().optional(),
    })
    .optional(),
  objective: z
    .object({
      desiredRole: z.string().optional(),
      seniority: z.enum(['junior', 'mid', 'senior', 'specialist', 'staff']).optional().catch(undefined),
      modality: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional().catch(undefined),
      contractType: z.enum(['clt', 'pj', 'both']).optional().catch(undefined),
      salaryMin: z.number().optional(),
      salaryMax: z.number().optional(),
      availabilityDays: z.number().optional(),
      professionalSummary: z.string().optional(),
    })
    .optional(),
  experiences: z
    .array(z.any())
    .transform((arr) => arr.map(normalizeExperience))
    .pipe(
      z.array(
        z.object({
          id: z.string(),
          company: z.string(),
          role: z.string(),
          startDate: z.string(),
          endDate: z.string(),
          description: z.string(),
          stack: z.array(z.string()),
        })
      )
    )
    .optional(),
  education: z
    .array(z.any())
    .transform((arr) => arr.map(normalizeEducation))
    .pipe(
      z.array(
        z.object({
          id: z.string(),
          institution: z.string(),
          course: z.string(),
          degree: z.enum(['graduation', 'postgrad', 'mba', 'bootcamp', 'technical']).catch('graduation'),
          startDate: z.string(),
          endDate: z.string(),
          status: z.enum(['complete', 'ongoing']),
        })
      )
    )
    .optional(),
  skills: z
    .object({
      technical: z
        .array(
          z.object({
            name: z.string(),
            level: z.enum(['basic', 'intermediate', 'advanced', 'expert']).catch('intermediate'),
          })
        )
        .optional(),
      tools: z.array(z.string()).optional(),
      languages: z
        .array(
          z.object({
            language: z.string(),
            level: z.enum(['basic', 'intermediate', 'advanced', 'fluent', 'native']).catch('intermediate'),
          })
        )
        .optional(),
      soft: z.array(z.string()).optional(),
    })
    .optional(),
})

const EXTRACTION_PROMPT = `You are a professional profile extractor. Extract ALL available information from the resume/CV text below and return a JSON object.

Target JSON structure (omit fields you truly cannot find — but look hard):

{
  "personal": {
    "fullName": "Full name of the person",
    "email": "email address",
    "phone": "phone number",
    "city": "city",
    "state": "state/province",
    "country": "country (default Brazil if not stated)",
    "linkedinUrl": "full linkedin.com/in/... URL",
    "githubUrl": "full github.com/... URL",
    "portfolioUrl": "personal website or portfolio URL"
  },
  "objective": {
    "desiredRole": "current or most recent job title",
    "seniority": "junior|mid|senior|specialist|staff",
    "modality": "remote|hybrid|onsite|any",
    "contractType": "clt|pj|both",
    "professionalSummary": "2-4 sentence professional summary"
  },
  "experiences": [
    {
      "id": "exp-1",
      "company": "Company name",
      "role": "Job title",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or current",
      "description": "responsibilities and achievements",
      "stack": ["tech1", "tech2"]
    }
  ],
  "education": [
    {
      "id": "edu-1",
      "institution": "University or school name",
      "course": "Course or field of study",
      "degree": "graduation|postgrad|mba|bootcamp|technical",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or ongoing",
      "status": "complete|ongoing"
    }
  ],
  "skills": {
    "technical": [{ "name": "React", "level": "basic|intermediate|advanced|expert" }],
    "tools": ["Git", "Docker"],
    "languages": [{ "language": "English", "level": "basic|intermediate|advanced|fluent|native" }],
    "soft": ["Leadership", "Communication"]
  }
}

Rules:
- personal.fullName: look at the very top of the resume — it is almost always the largest/first text
- personal.email: look for @ symbol anywhere
- personal.phone: look for phone/tel/whatsapp number patterns
- personal.linkedinUrl: look for linkedin.com/in/ anywhere in the document — include the full URL
- personal.githubUrl: look for github.com/ anywhere — include the full URL
- personal.portfolioUrl: look for personal websites, portfolio links
- Dates must be "YYYY-MM" format
- For skills.technical, infer level from context (years of experience, seniority of roles)
- Return ONLY valid JSON, no markdown fences, no extra text`

// Recursively remove null values so Zod .optional() fields don't fail on null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripNulls(value: any): any {
  if (Array.isArray(value)) return value.map(stripNulls)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, stripNulls(v)])
    )
  }
  return value
}

async function extractProfileWithClaude(text: string): Promise<Partial<UserProfile>> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\n---\n${text.slice(0, 15000)}`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  // Strip markdown fences if Claude wrapped the JSON despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned)
  // Claude sometimes returns null for optional fields — strip them before validation
  const sanitized = stripNulls(parsed)
  const validated = importedProfileSchema.parse(sanitized)
  return validated as Partial<UserProfile>
}

// ---------------------------------------------------------------------------
// importFromCVAction
// ---------------------------------------------------------------------------
export async function importFromCVAction(formData: FormData): Promise<Partial<UserProfile>> {
  await requireUserId()

  const file = formData.get('file')
  if (!(file instanceof File)) throw new Error('No file provided')
  if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds 5MB limit')

  const buffer = Buffer.from(await file.arrayBuffer())

  // Dynamic import: pdf-parse v1 is a CJS module — default export is the function
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse')
  const parsed = await pdfParse(buffer)
  const text = parsed.text

  if (!text || text.trim().length < 100) {
    throw new Error('Could not extract readable text from the PDF')
  }

  return extractProfileWithClaude(text)
}

// ---------------------------------------------------------------------------
// importFromLinkedInAction
// ---------------------------------------------------------------------------
export async function importFromLinkedInAction(_url: string): Promise<Partial<UserProfile>> {
  // LinkedIn blocks server-side requests with HTTP 999 (anti-bot).
  // Direct scraping is not viable. Guide the user to export their profile as PDF instead.
  throw new Error(
    'LinkedIn blocks automated access. To import your LinkedIn profile, go to your LinkedIn profile page → More → Save to PDF, then upload that PDF here.'
  )
}
