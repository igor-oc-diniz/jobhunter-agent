import Anthropic from '@anthropic-ai/sdk'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin'
import { getEnabledScrapers } from '../scrapers'
import { runMatching } from '../matching/matcher'
import { generateCV } from '../cv/cv-generator'
import { generateCoverLetter } from '../cover-letter/cover-letter-generator'
import { fillAndSubmitForm } from '../form-filler/form-filler'
import { createRunLogger } from '../utils/logger'
import { v4 as uuidv4 } from 'uuid'
import { ORCHESTRATOR } from '@/lib/constants/agent'
import type { UserProfile, RawJob, MatchDetails } from '@/types'

const client = new Anthropic()

async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const snap = await adminDb.doc(`users/${userId}/profile/data`).get()
  return snap.exists ? (snap.data() as UserProfile) : null
}

async function checkDailyLimit(userId: string, limit: number): Promise<{ canApply: boolean; appliedToday: number }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const snap = await adminDb
    .collection(`users/${userId}/applications`)
    .where('appliedAt', '>=', Timestamp.fromDate(today))
    .where('status', 'not-in', ['failed', 'withdrawn'])
    .get()

  return { canApply: snap.size < limit, appliedToday: snap.size }
}

async function updateAgentStatus(userId: string, status: string, message: string) {
  await adminDb.doc(`users/${userId}/profile/data`).set(
    { agentStatus: { status, message, updatedAt: FieldValue.serverTimestamp() } },
    { merge: true }
  )
}

async function getNextQueuedJob(userId: string): Promise<RawJob | null> {
  const queueSnap = await adminDb
    .collection(`users/${userId}/applicationQueue`)
    .where('status', '==', 'queued')
    .orderBy('priority', 'desc')
    .limit(1)
    .get()

  if (queueSnap.empty) return null

  const queueItem = queueSnap.docs[0].data()
  const jobSnap = await adminDb.doc(`users/${userId}/rawJobs/${queueItem.jobId}`).get()
  return jobSnap.exists ? (jobSnap.data() as RawJob) : null
}

// Tool implementations
const tools: Anthropic.Tool[] = [
  {
    name: 'run_scraper',
    description: 'Runs the job scraper for a specific platform',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: { type: 'string', enum: ['gupy', 'indeed', 'linkedin', 'infojobs'] },
        keywords: { type: 'array', items: { type: 'string' } },
        maxPages: { type: 'number' },
      },
      required: ['platform', 'keywords'],
    },
  },
  {
    name: 'run_matching',
    description: 'Processes pending jobs and calculates compatibility scores',
    input_schema: {
      type: 'object' as const,
      properties: { batchSize: { type: 'number' } },
    },
  },
  {
    name: 'generate_cv',
    description: 'Generates a personalized resume for a specific job',
    input_schema: {
      type: 'object' as const,
      properties: { jobId: { type: 'string' } },
      required: ['jobId'],
    },
  },
  {
    name: 'generate_cover_letter',
    description: 'Generates a cover letter for a specific job',
    input_schema: {
      type: 'object' as const,
      properties: { jobId: { type: 'string' } },
      required: ['jobId'],
    },
  },
  {
    name: 'fill_and_submit_form',
    description: 'Fills and submits the job application form',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: { type: 'string' },
        cvUrl: { type: 'string' },
        coverLetterText: { type: 'string' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'get_pipeline_status',
    description: 'Returns current pipeline state: pending jobs, queue, daily limit',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'update_agent_status',
    description: 'Updates agent status in Firestore for the dashboard',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['running', 'idle', 'blocked', 'error'] },
        message: { type: 'string' },
      },
      required: ['status', 'message'],
    },
  },
]

export async function runAgentCycle(userId: string): Promise<void> {
  const runId = uuidv4()
  const log = createRunLogger(runId, userId)

  const profile = await loadUserProfile(userId)
  if (!profile) {
    log.warn('no_profile_found', { userId })
    return
  }

  await updateAgentStatus(userId, 'running', 'Starting cycle')
  log.info('cycle_started', { userId })

  const systemPrompt = `You are an autonomous job application agent.

Your goals this cycle:
1. Check the daily application limit (max: ${profile.agentConfig.maxApplicationsPerDay})
2. If capacity exists, run the scraper on enabled platforms
3. Process matching for scraped jobs
4. For each approved job (priority order):
   a. Generate personalized CV
   b. Generate cover letter
   c. Fill and submit form
5. Stop when daily limit is reached or no more jobs exist

Enabled platforms: ${profile.agentConfig.enabledPlatforms.join(', ')}
Keywords: ${profile.agentConfig.searchKeywords.join(', ')}
Daily limit: ${profile.agentConfig.maxApplicationsPerDay}
Mode: ${profile.agentConfig.mode}

Use the available tools. Make intelligent decisions:
- If a platform fails, continue with the others
- If an application fails, continue with the next
- If CAPTCHA is detected, pause that application and continue others
- Update agent status regularly`

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: 'Start the application cycle.' },
  ]

  let iterations = 0
  const maxIterations = ORCHESTRATOR.MAX_ITERATIONS

  while (iterations < maxIterations) {
    iterations++

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      log.info('cycle_completed_by_agent', { iterations })
      break
    }

    if (response.stop_reason !== 'tool_use') break

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      const input = block.input as Record<string, unknown>
      let result: unknown

      try {
        result = await dispatchTool(block.name, input, userId, profile, log)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        result = { error: message }
        log.error('tool_error', { tool: block.name, error: message })
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  await updateAgentStatus(userId, 'idle', 'Cycle completed')

  // Save run log
  await adminDb.collection(`users/${userId}/agentLogs`).doc(runId).set({
    runId,
    userId,
    completedAt: FieldValue.serverTimestamp(),
    status: 'completed',
    entries: log.getEntries().slice(-ORCHESTRATOR.MAX_LOG_ENTRIES),
  })

  log.info('cycle_finished', { iterations })
}

async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  profile: UserProfile,
  log: ReturnType<typeof createRunLogger>
): Promise<unknown> {
  switch (name) {
    case 'run_scraper': {
      const scraper = getEnabledScrapers([input.platform as string])[0]
      if (!scraper) return { error: `Unknown platform: ${input.platform}` }
      const jobs = await scraper.scrape(userId, {
        keywords: input.keywords as string[],
        maxPages: input.maxPages as number | undefined,
      })
      log.info('scraper_done', { platform: input.platform, jobsFound: jobs.length })
      return { jobsFound: jobs.length }
    }

    case 'run_matching': {
      await runMatching(userId, profile)
      return { ok: true }
    }

    case 'generate_cv': {
      const jobId = input.jobId as string
      const jobSnap = await adminDb.doc(`users/${userId}/rawJobs/${jobId}`).get()
      if (!jobSnap.exists) return { error: 'Job not found' }
      const job = jobSnap.data() as RawJob
      const matchDetails = job.matchDetails as MatchDetails
      const { pdfUrl, generatedAt } = await generateCV(userId, jobId, job, profile, matchDetails)
      await adminDb.doc(`users/${userId}/applications/${jobId}`).set({ cvUrl: pdfUrl, cvGeneratedAt: FieldValue.serverTimestamp() }, { merge: true })
      return { pdfUrl, generatedAt }
    }

    case 'generate_cover_letter': {
      const jobId = input.jobId as string
      const jobSnap = await adminDb.doc(`users/${userId}/rawJobs/${jobId}`).get()
      if (!jobSnap.exists) return { error: 'Job not found' }
      const job = jobSnap.data() as RawJob
      const matchDetails = job.matchDetails as MatchDetails
      const text = await generateCoverLetter(userId, jobId, job, profile, matchDetails)
      return { coverLetterText: text }
    }

    case 'fill_and_submit_form': {
      const jobId = input.jobId as string
      const jobSnap = await adminDb.doc(`users/${userId}/rawJobs/${jobId}`).get()
      if (!jobSnap.exists) return { error: 'Job not found' }
      const job = jobSnap.data() as RawJob
      const result = await fillAndSubmitForm(
        userId,
        jobId,
        job,
        profile,
        '', // cv file path — passed from generate_cv result in real flow
        input.coverLetterText as string ?? ''
      )
      return result
    }

    case 'get_pipeline_status': {
      const { canApply, appliedToday } = await checkDailyLimit(userId, profile.agentConfig.maxApplicationsPerDay)
      const pendingSnap = await adminDb.collection(`users/${userId}/rawJobs`).where('status', '==', 'pending').get()
      const queueSnap = await adminDb.collection(`users/${userId}/applicationQueue`).where('status', '==', 'queued').get()
      return { canApply, appliedToday, pending: pendingSnap.size, queued: queueSnap.size }
    }

    case 'update_agent_status': {
      await updateAgentStatus(userId, input.status as string, input.message as string)
      return { ok: true }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
