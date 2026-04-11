import Anthropic from '@anthropic-ai/sdk'
import Handlebars from 'handlebars'
import puppeteer from 'puppeteer'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, adminStorage } from '../firebase-admin'
import logger from '../utils/logger'
import type { RawJob, UserProfile, MatchDetails } from '@/types'

const client = new Anthropic()

const cvContentSchema = z.object({
  summary: z.string(),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    })
  ),
  skillsHighlighted: z.array(z.string()),
  skillsOther: z.array(z.string()),
})

type CVContent = z.infer<typeof cvContentSchema>

const CV_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; padding: 20mm 15mm; }
h1 { font-size: 20pt; font-weight: 700; }
h2 { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1.5px solid #111; padding-bottom: 3px; margin: 14px 0 8px; }
.contact { font-size: 9pt; color: #444; margin-top: 4px; }
.contact a { color: #444; text-decoration: none; }
.experience { margin-bottom: 10px; }
.exp-header { display: flex; justify-content: space-between; }
.exp-role { font-weight: 700; }
.exp-company { font-size: 9.5pt; color: #555; }
.exp-period { font-size: 9pt; color: #777; }
ul { padding-left: 14px; margin-top: 4px; }
li { margin-bottom: 2px; }
.skills-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.skill-tag { background: #f0f0f0; padding: 2px 8px; border-radius: 3px; font-size: 9pt; }
.skill-tag.highlighted { background: #e8f4f8; font-weight: 600; }
@page { margin: 0; size: A4; }
</style>
</head>
<body>
<h1>{{fullName}}</h1>
<div class="contact">
  {{email}} · {{phone}} · {{city}}{{#if linkedinUrl}} · <a href="{{linkedinUrl}}">LinkedIn</a>{{/if}}{{#if githubUrl}} · <a href="{{githubUrl}}">GitHub</a>{{/if}}
</div>

<h2>Summary</h2>
<p>{{summary}}</p>

<h2>Experience</h2>
{{#each experiences}}
<div class="experience">
  <div class="exp-header">
    <div><span class="exp-role">{{role}}</span> · <span class="exp-company">{{company}}</span></div>
    <span class="exp-period">{{period}}</span>
  </div>
  <ul>{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>
</div>
{{/each}}

<h2>Education</h2>
{{#each education}}
<div><strong>{{course}}</strong> — {{institution}} ({{period}})</div>
{{/each}}

<h2>Skills</h2>
<div class="skills-list">
  {{#each skillsHighlighted}}<span class="skill-tag highlighted">{{this}}</span>{{/each}}
  {{#each skillsOther}}<span class="skill-tag">{{this}}</span>{{/each}}
</div>

<h2>Languages</h2>
{{#each languages}}<div>{{language}} — {{level}}</div>{{/each}}
</body>
</html>`

function buildCVPrompt(profile: UserProfile, job: RawJob, matchDetails: MatchDetails): string {
  return `You are a specialist in resume creation and ATS optimization.

Adapt the candidate's base resume to maximize compatibility with the target job below.

## TARGET JOB
Company: ${job.company}
Title: ${job.title}
Description: ${job.description.substring(0, 1500)}
Required stack: ${job.techStack.join(', ')}

## IDENTIFIED GAPS (do not invent what doesn't exist)
${matchDetails.gaps.join('\n')}

## MATCHING SUGGESTIONS
${matchDetails.cvAdaptations.join('\n')}

## CANDIDATE FULL PROFILE
Current summary: ${profile.objective.professionalSummary}
Experiences: ${JSON.stringify(profile.experiences)}
Skills: ${JSON.stringify(profile.skills.technical)}

## INSTRUCTIONS
1. Rewrite the professional summary (max 4 lines) focusing on what the company seeks
2. For each experience, select and rewrite the 3-5 most relevant bullets for this job
3. Order skills placing the most relevant to the job first
4. DO NOT invent experiences or skills the candidate doesn't have
5. DO NOT exaggerate achievements; use numbers when they exist in the provided data
6. Return ONLY the JSON in the format below:

{
  "summary": "...",
  "experiences": [{"company":"...","role":"...","period":"...","bullets":["..."],"stack":["..."]}],
  "skillsHighlighted": ["..."],
  "skillsOther": ["..."]
}`
}

export async function generateCV(
  userId: string,
  jobId: string,
  job: RawJob,
  profile: UserProfile,
  matchDetails: MatchDetails
): Promise<{ pdfUrl: string; generatedAt: string }> {
  // Check cache
  const appRef = adminDb.doc(`users/${userId}/applications/${jobId}`)
  const appSnap = await appRef.get()
  if (appSnap.exists) {
    const data = appSnap.data()!
    if (data.cvUrl && data.cvGeneratedAt) {
      const generatedAt = data.cvGeneratedAt.toDate()
      const ageHours = (Date.now() - generatedAt.getTime()) / 3600000
      if (ageHours < 24) {
        logger.info('cv_cache_hit', { userId, jobId })
        return { pdfUrl: data.cvUrl, generatedAt: generatedAt.toISOString() }
      }
    }
  }

  // Call Claude
  let cvContent: CVContent
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildCVPrompt(profile, job, matchDetails) }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    cvContent = cvContentSchema.parse(JSON.parse(text))
  } catch (err) {
    logger.warn('cv_claude_error', { userId, jobId, error: String(err) })
    // Fallback: use raw profile data
    cvContent = {
      summary: profile.objective.professionalSummary,
      experiences: profile.experiences.map((e) => ({
        company: e.company,
        role: e.role,
        period: `${e.startDate} – ${e.endDate}`,
        bullets: e.description.split('.').filter(Boolean).slice(0, 4),
        stack: e.stack,
      })),
      skillsHighlighted: profile.skills.technical.filter((s) => job.techStack.includes(s.name)).map((s) => s.name),
      skillsOther: profile.skills.technical.filter((s) => !job.techStack.includes(s.name)).map((s) => s.name),
    }
  }

  // Render HTML
  const template = Handlebars.compile(CV_TEMPLATE)
  const html = template({
    fullName: profile.personal.fullName,
    email: profile.personal.email,
    phone: profile.personal.phone,
    city: profile.personal.city,
    linkedinUrl: profile.personal.linkedinUrl,
    githubUrl: profile.personal.githubUrl,
    summary: cvContent.summary,
    experiences: cvContent.experiences,
    education: profile.education.map((e) => ({
      course: e.course,
      institution: e.institution,
      period: `${e.startDate} – ${e.endDate}`,
    })),
    skillsHighlighted: cvContent.skillsHighlighted,
    skillsOther: cvContent.skillsOther,
    languages: profile.skills.languages,
  })

  // Generate PDF
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  let pdfBuffer: Buffer
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    pdfBuffer = Buffer.from(
      await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
    )
  } finally {
    await browser.close()
  }

  // Upload to Storage
  const timestamp = Date.now()
  const path = `cvs/${userId}/${jobId}/${timestamp}.pdf`
  const bucket = adminStorage.bucket()
  const file = bucket.file(path)

  await file.save(pdfBuffer, { contentType: 'application/pdf' })
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  const generatedAt = new Date().toISOString()
  logger.info('cv_generated', { userId, jobId, path })

  return { pdfUrl: signedUrl, generatedAt }
}
