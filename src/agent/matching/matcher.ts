import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin'
import logger from '../utils/logger'
import { MATCHING } from '@/lib/constants/agent'
import type { RawJob, UserProfile, MatchDetails } from '@/types'

const client = new Anthropic()

const claudeMatchSchema = z.object({
  semanticScore: z.number().min(0).max(100),
  seniorityMatch: z.enum(['under', 'match', 'over']),
  positives: z.array(z.string()),
  gaps: z.array(z.string()),
  cvAdaptations: z.array(z.string()),
  redFlags: z.array(z.string()),
  justification: z.string(),
  recommended: z.boolean(),
})

type ClaudeMatchResult = z.infer<typeof claudeMatchSchema>

function buildMatchingPrompt(job: RawJob, profile: UserProfile): string {
  return `You are a technology recruitment specialist.

Analyze the compatibility between the candidate and the job below and return a structured JSON.

## CANDIDATE PROFILE
- Desired role: ${profile.objective.desiredRole}
- Seniority: ${profile.objective.seniority}
- Main stack: ${profile.skills.technical.map((s) => `${s.name} (${s.level})`).join(', ')}
- Contract type: ${profile.objective.contractType}
- Modality: ${profile.objective.modality}
- Salary expectation: R$ ${profile.objective.salaryMin}–${profile.objective.salaryMax}
- Summary: ${profile.objective.professionalSummary}

## JOB
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location} ${job.isRemote ? '(Remote)' : ''}
- Contract: ${job.contractType ?? 'not specified'}
- Salary: ${job.salaryMin ? `R$ ${job.salaryMin}–${job.salaryMax}` : 'not specified'}
- Description: ${job.description.substring(0, 2000)}

## INSTRUCTIONS
Return ONLY the JSON below, no additional text:

{
  "semanticScore": <number 0-100>,
  "seniorityMatch": <"under" | "match" | "over">,
  "positives": [<string>, <string>, <string>],
  "gaps": [<string>],
  "cvAdaptations": [<string>, <string>],
  "redFlags": [<string>],
  "justification": "<2-3 line paragraph explaining the score>",
  "recommended": <true | false>
}`
}

function calculateFinalScore(job: RawJob, profile: UserProfile, claude: ClaudeMatchResult): number {
  const weights = { stack: 0.35, seniority: 0.20, contract: 0.15, modality: 0.10, salary: 0.10, semantic: 0.10 }

  const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
  const jobStack = job.techStack.map((t) => t.toLowerCase())
  const stackScore =
    jobStack.length > 0
      ? (jobStack.filter((t) => userStack.includes(t)).length / jobStack.length) * 100
      : 50

  const seniorityMap: Record<string, number> = { under: 40, match: 100, over: 60 }
  const seniorityScore = seniorityMap[claude.seniorityMatch]

  const contractScore =
    !job.contractType ||
    job.contractType === 'unknown' ||
    profile.objective.contractType === 'both' ||
    job.contractType === profile.objective.contractType
      ? 100
      : 0

  const modalityScore =
    (job.isRemote && ['remote', 'any'].includes(profile.objective.modality)) ||
    (!job.isRemote && ['onsite', 'hybrid', 'any'].includes(profile.objective.modality))
      ? 100
      : 20

  let salaryScore = 50
  if (job.salaryMax && profile.objective.salaryMin) {
    salaryScore = job.salaryMax >= profile.objective.salaryMin ? 100 : 0
  }

  return Math.round(
    stackScore * weights.stack +
      seniorityScore * weights.seniority +
      contractScore * weights.contract +
      modalityScore * weights.modality +
      salaryScore * weights.salary +
      claude.semanticScore * weights.semantic
  )
}

function preFilter(job: RawJob, profile: UserProfile): boolean {
  const excludeKeywords = profile.agentConfig.excludeKeywords.map((k) => k.toLowerCase())

  if (excludeKeywords.some((kw) => job.company.toLowerCase().includes(kw))) return false
  if (excludeKeywords.some((kw) => job.techStack.map((t) => t.toLowerCase()).includes(kw))) return false
  if (job.salaryMax && profile.objective.salaryMin && job.salaryMax < profile.objective.salaryMin) return false

  const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
  const jobStack = job.techStack.map((t) => t.toLowerCase())
  const overlap = jobStack.length > 0
    ? jobStack.filter((t) => userStack.includes(t)).length / jobStack.length
    : 0.5

  return overlap >= MATCHING.MIN_STACK_OVERLAP // at least 10% stack overlap for pre-filter
}

export async function matchJob(
  job: RawJob,
  profile: UserProfile,
  userId: string
): Promise<number> {
  // Pre-filter without Claude
  if (!preFilter(job, profile)) {
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'rejected',
      matchScore: 0,
      'matchDetails.justification': 'Filtered out by pre-filter rules.',
    })
    await addToBlacklist(userId, job, 'score_too_low')
    return 0
  }

  let claude: ClaudeMatchResult
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildMatchingPrompt(job, profile) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    claude = claudeMatchSchema.parse(JSON.parse(text))
  } catch (err) {
    logger.warn('claude_match_parse_error', { jobId: job.id, error: String(err) })
    // Fallback: use local score only
    const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
    const jobStack = job.techStack.map((t) => t.toLowerCase())
    const fallbackScore = jobStack.length > 0
      ? Math.round((jobStack.filter((t) => userStack.includes(t)).length / jobStack.length) * 100)
      : 50
    claude = {
      semanticScore: fallbackScore,
      seniorityMatch: 'match',
      positives: [],
      gaps: [],
      cvAdaptations: [],
      redFlags: [],
      justification: 'Score calculated locally due to API error.',
      recommended: fallbackScore >= profile.agentConfig.minScore,
    }
  }

  const score = calculateFinalScore(job, profile, claude)
  const threshold = profile.agentConfig.minScore

  const matchDetails: Omit<MatchDetails, 'matchedAt'> = {
    stackOverlap: 0,
    seniorityScore: 0,
    contractScore: 0,
    modalityScore: 0,
    salaryScore: 0,
    semanticScore: claude.semanticScore,
    positives: claude.positives,
    gaps: claude.gaps,
    cvAdaptations: claude.cvAdaptations,
    redFlags: claude.redFlags,
    justification: claude.justification,
  }

  if (score >= threshold && claude.recommended && claude.redFlags.length === 0) {
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'matched',
      matchScore: score,
      matchDetails: { ...matchDetails, matchedAt: FieldValue.serverTimestamp() },
    })

    // Add to application queue
    const priority = score * 1000 + (job.salaryMax ?? 0) / 1000
    await adminDb.doc(`users/${userId}/applicationQueue/${job.id}`).set({
      jobId: job.id,
      priority,
      matchScore: score,
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    })

    logger.info('job_matched', { userId, jobId: job.id, score })
  } else {
    const reason = claude.redFlags.length > 0 ? 'Red flag detected' : 'Score below threshold'
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'rejected',
      matchScore: score,
      matchDetails: { ...matchDetails, matchedAt: FieldValue.serverTimestamp() },
    })
    await addToBlacklist(userId, job, 'score_too_low')
    logger.info('job_rejected', { userId, jobId: job.id, score, reason })
  }

  return score
}

async function addToBlacklist(userId: string, job: RawJob, reason: string) {
  await adminDb.collection(`users/${userId}/blacklist`).add({
    sourceUrl: job.sourceUrl,
    company: job.company,
    title: job.title,
    addedAt: FieldValue.serverTimestamp(),
    reason,
  })
}

export async function runMatching(userId: string, profile: UserProfile): Promise<void> {
  const snap = await adminDb
    .collection(`users/${userId}/rawJobs`)
    .where('status', '==', 'pending')
    .limit(20)
    .get()

  if (snap.empty) {
    logger.info('no_pending_jobs', { userId })
    return
  }

  logger.info('matching_started', { userId, count: snap.size })

  for (const doc of snap.docs) {
    const job = doc.data() as RawJob
    try {
      await matchJob(job, profile, userId)
    } catch (err) {
      logger.error('match_error', { userId, jobId: job.id, error: String(err) })
    }
  }
}
