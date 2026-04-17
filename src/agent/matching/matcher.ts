import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin'
import logger from '../utils/logger'
import { MATCHING } from '@/lib/constants/agent'
import type { RawJob, UserProfile, MatchDetails, DescriptionSections } from '@/types'

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
  descriptionSections: z.object({
    aboutCompany: z.string(),
    jobActivities: z.string(),
    cultural: z.string(),
  }),
})

type ClaudeMatchResult = z.infer<typeof claudeMatchSchema>

/**
 * Extracts JSON from a Claude response that may include markdown code fences.
 */
function extractJson(text: string): string {
  // Try to extract from ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  // Fallback: try to find first { ... }
  const braceStart = text.indexOf('{')
  const braceEnd = text.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd !== -1) return text.slice(braceStart, braceEnd + 1)
  return text.trim()
}

function buildMatchingPrompt(job: RawJob, profile: UserProfile): string {
  return `You are a strict technical recruiter. Analyze if this job is a genuine fit for the candidate.

## CANDIDATE PROFILE
- Desired role: ${profile.objective.desiredRole}
- Seniority: ${profile.objective.seniority}
- Main stack: ${profile.skills.technical.map((s) => `${s.name} (${s.level})`).join(', ')}
- Modality: ${profile.objective.modality}
- Summary: ${profile.objective.professionalSummary}

## JOB
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location} ${job.isRemote ? '(Remote)' : ''}
- Salary: ${job.salaryMin ? `R$ ${job.salaryMin}–${job.salaryMax}` : 'not specified'}
- Description: ${job.description.substring(0, 3000)}

## SCORING INSTRUCTIONS
- semanticScore (0–100): how closely the job role and responsibilities match the candidate's desired role and skills.
  * 0–30: completely different role or stack
  * 31–59: some overlap but significant mismatches
  * 60–79: moderate fit, candidate could do the job with some ramp-up
  * 80–100: strong fit, role and stack align closely
- Be strict: a DevOps job for a frontend developer should score < 30, even if they share some tools.
- seniorityMatch rules: use "match" when the candidate's experience is within ±2 years of what the job requires. Use "over" only if the gap is more than 2 years above, "under" only if more than 2 years below. When in doubt, default to "match".
- recommended: true ONLY if semanticScore >= 65 AND seniorityMatch != "under" AND no critical redFlags.

## DESCRIPTION PARSING
Also extract from the job description:
- aboutCompany: 2–4 sentences about the company (mission, product, size, industry). If not mentioned, write "Not specified."
- jobActivities: bullet-point summary of the main day-to-day responsibilities.
- cultural: any cultural values, work style, or team environment mentioned. If not mentioned, write "Not specified."

Return ONLY valid JSON (no markdown fences):

{
  "semanticScore": <number 0-100>,
  "seniorityMatch": <"under" | "match" | "over">,
  "positives": [<string>, <string>, <string>],
  "gaps": [<string>],
  "cvAdaptations": [<string>, <string>],
  "redFlags": [<string>],
  "justification": "<2-3 line paragraph explaining the score>",
  "recommended": <true | false>,
  "descriptionSections": {
    "aboutCompany": "<string>",
    "jobActivities": "<string>",
    "cultural": "<string>"
  }
}`
}

interface ScoreBreakdown {
  stackOverlap: number
  seniorityScore: number
  contractScore: number
  modalityScore: number
  salaryScore: number
  finalScore: number
}

export function calculateScoreBreakdown(job: RawJob, profile: UserProfile, claude: ClaudeMatchResult): ScoreBreakdown {
  // Rebalanced: semantic score carries more weight since Claude is the authoritative judge
  const weights = { stack: 0.20, seniority: 0.15, contract: 0.10, modality: 0.10, salary: 0.05, semantic: 0.40 }

  const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
  const jobStack = job.techStack.map((t) => t.toLowerCase())
  const stackOverlap =
    jobStack.length > 0
      ? (jobStack.filter((t) => userStack.includes(t)).length / jobStack.length) * 100
      : 50

  const seniorityMap: Record<string, number> = { under: 40, match: 100, over: 85 }
  const seniorityScore = seniorityMap[claude.seniorityMatch]

  const contractScore = 100 // contract type (CLT/PJ) is not a filter criterion

  const modalityScore =
    (job.isRemote && ['remote', 'any'].includes(profile.objective.modality)) ||
    (!job.isRemote && ['onsite', 'hybrid', 'any'].includes(profile.objective.modality))
      ? 100
      : 20

  let salaryScore = 50
  if (job.salaryMax && profile.objective.salaryMin) {
    salaryScore = job.salaryMax >= profile.objective.salaryMin ? 100 : 0
  }

  const finalScore = Math.round(
    stackOverlap * weights.stack +
      seniorityScore * weights.seniority +
      contractScore * weights.contract +
      modalityScore * weights.modality +
      salaryScore * weights.salary +
      claude.semanticScore * weights.semantic
  )

  return { stackOverlap, seniorityScore, contractScore, modalityScore, salaryScore, finalScore }
}

/**
 * Pre-filter: fast local checks before spending Claude API tokens.
 * Returns false if the job should be immediately rejected.
 */
function preFilter(job: RawJob, profile: UserProfile): { pass: boolean; reason?: string } {
  const excludeKeywords = profile.agentConfig.excludeKeywords.map((k) => k.toLowerCase())

  if (excludeKeywords.some((kw) => job.company.toLowerCase().includes(kw))) {
    return { pass: false, reason: `company matches exclude keyword` }
  }
  if (excludeKeywords.some((kw) => job.techStack.map((t) => t.toLowerCase()).includes(kw))) {
    return { pass: false, reason: `tech stack matches exclude keyword` }
  }
  // Title relevance: extract words from desired role and check at least one appears in job title
  const desiredWords = profile.objective.desiredRole
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
  const jobTitleLower = job.title.toLowerCase()
  const titleMatch = desiredWords.some((w) => jobTitleLower.includes(w))
  if (!titleMatch) {
    return { pass: false, reason: `title mismatch — "${job.title}" has none of [${desiredWords.join(', ')}]` }
  }

  // Minimum stack overlap
  const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
  const jobStack = job.techStack.map((t) => t.toLowerCase())
  const matchedSkills = jobStack.filter((t) => userStack.includes(t))
  const overlap =
    jobStack.length > 0
      ? matchedSkills.length / jobStack.length
      : 0.3 // no stack info → give benefit of the doubt

  if (overlap < MATCHING.MIN_STACK_OVERLAP) {
    return {
      pass: false,
      reason: `stack overlap too low (${Math.round(overlap * 100)}% < ${Math.round(MATCHING.MIN_STACK_OVERLAP * 100)}% — matched: [${matchedSkills.join(', ') || 'none'}], required from job: [${jobStack.join(', ')}])`,
    }
  }

  return { pass: true }
}

export async function matchJob(
  job: RawJob,
  profile: UserProfile,
  userId: string,
  log?: LogFn
): Promise<{ score: number; status: 'matched' | 'rejected' | 'prefiltered' }> {
  const filter = preFilter(job, profile)
  if (!filter.pass) {
    logger.info('prefilter_rejected', { userId, jobId: job.id, title: job.title, reason: filter.reason })
    log?.('info', 'prefilter_rejected', `  ✗ pré-filtro: ${filter.reason}`)
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'rejected',
      matchScore: 0,
      'matchDetails.justification': `Pre-filter: ${filter.reason}`,
    })
    await addToBlacklist(userId, job, 'score_too_low')
    return { score: 0, status: 'prefiltered' }
  }
  logger.info('prefilter_passed', { userId, jobId: job.id, title: job.title, company: job.company })
  log?.('info', 'prefilter_passed', `  ✓ passou pré-filtro → enviando para Claude`)

  let claude: ClaudeMatchResult
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildMatchingPrompt(job, profile) }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonStr = extractJson(raw)
    claude = claudeMatchSchema.parse(JSON.parse(jsonStr))
  } catch (err) {
    logger.warn('claude_match_parse_error', { jobId: job.id, error: String(err) })
    // Fallback: conservative local score — avoid inflating rejected jobs
    const userStack = profile.skills.technical.map((s) => s.name.toLowerCase())
    const jobStack = job.techStack.map((t) => t.toLowerCase())
    const fallbackScore = jobStack.length > 0
      ? Math.round((jobStack.filter((t) => userStack.includes(t)).length / jobStack.length) * 100)
      : 40
    claude = {
      semanticScore: fallbackScore,
      seniorityMatch: 'match',
      positives: [],
      gaps: [],
      cvAdaptations: [],
      redFlags: ['Score calculated locally — Claude API unavailable. Manual review recommended.'],
      justification: 'Score calculated locally due to API error.',
      recommended: false, // never auto-recommend on fallback
      descriptionSections: { aboutCompany: '', jobActivities: '', cultural: '' },
    }
  }

  const breakdown = calculateScoreBreakdown(job, profile, claude)
  const score = breakdown.finalScore
  const threshold = profile.agentConfig.minScore

  const matchDetails: Omit<MatchDetails, 'matchedAt'> = {
    stackOverlap: breakdown.stackOverlap,
    seniorityScore: breakdown.seniorityScore,
    contractScore: breakdown.contractScore,
    modalityScore: breakdown.modalityScore,
    salaryScore: breakdown.salaryScore,
    semanticScore: claude.semanticScore,
    positives: claude.positives,
    gaps: claude.gaps,
    cvAdaptations: claude.cvAdaptations,
    redFlags: claude.redFlags,
    justification: claude.justification,
  }

  const descriptionSections: DescriptionSections = claude.descriptionSections

  if (score >= threshold && claude.recommended) {
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'matched',
      matchScore: score,
      descriptionSections,
      matchDetails: { ...matchDetails, matchedAt: FieldValue.serverTimestamp() },
    })

    const priority = score * 1000 + (job.salaryMax ?? 0) / 1000
    await adminDb.doc(`users/${userId}/applicationQueue/${job.id}`).set({
      jobId: job.id,
      priority,
      matchScore: score,
      status: 'queued',
      createdAt: FieldValue.serverTimestamp(),
    })

    logger.info('job_matched', { userId, jobId: job.id, score })
    log?.('info', 'job_matched', `  ✅ APROVADA score=${score} — ${claude.justification}`)
    return { score, status: 'matched' }
  } else {
    const reason = `score ${score} < threshold ${threshold}${!claude.recommended ? ' + not recommended' : ''}`
    await adminDb.doc(`users/${userId}/rawJobs/${job.id}`).update({
      status: 'rejected',
      matchScore: score,
      descriptionSections,
      matchDetails: { ...matchDetails, matchedAt: FieldValue.serverTimestamp() },
    })
    await addToBlacklist(userId, job, 'score_too_low')
    logger.info('job_rejected', { userId, jobId: job.id, score, reason })
    log?.('info', 'job_rejected', `  ✗ rejeitada score=${score} — ${reason}`)
    return { score, status: 'rejected' }
  }
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

type LogFn = (level: 'info' | 'warn' | 'error', action: string, message: string) => void

export async function runMatching(userId: string, profile: UserProfile, addEntry?: LogFn): Promise<void> {
  const log = (level: 'info' | 'warn' | 'error', action: string, message: string) => {
    logger[level](action, { userId })
    addEntry?.(level, action, message)
  }

  const totalSnap = await adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'pending').get()
  const totalPending = totalSnap.size

  const snap = await adminDb
    .collection(`users/${userId}/rawJobs`)
    .where('status', '==', 'pending')
    .limit(MATCHING.MAX_JOBS_BATCH)
    .get()

  if (snap.empty) {
    log('info', 'no_pending_jobs', 'Nenhuma vaga pendente para análise')
    return
  }

  log(
    'info',
    'matching_batch_info',
    `Processando ${snap.size} de ${totalPending} vagas pendentes` +
      (totalPending > snap.size ? ` (${totalPending - snap.size} puladas pelo limite de batch)` : '') +
      ` | role: "${profile.objective.desiredRole}" | stack: [${profile.skills.technical.map((s) => s.name).join(', ')}] | minScore: ${profile.agentConfig.minScore}`
  )

  let prefiltered = 0
  let matched = 0
  let rejected = 0

  for (let i = 0; i < snap.docs.length; i++) {
    const doc = snap.docs[i]
    const job = doc.data() as RawJob
    log('info', 'matching_job', `[${i + 1}/${snap.size}] ${job.title} @ ${job.company} (${job.sourcePlatform})`)
    try {
      const result = await matchJob(job, profile, userId, log)
      if (result.status === 'prefiltered') {
        prefiltered++
      } else if (result.status === 'matched') {
        matched++
      } else {
        rejected++
      }
    } catch (err) {
      log('error', 'match_error', `Erro ao analisar "${job.title}": ${String(err)}`)
    }
  }

  log(
    'info',
    'matching_summary',
    `Resumo: ${snap.size} processadas — ${matched} aprovadas, ${rejected} rejeitadas pelo Claude, ${prefiltered} pelo pré-filtro` +
      (totalPending > snap.size ? `, ${totalPending - snap.size} não processadas (batch limit)` : '')
  )
}
