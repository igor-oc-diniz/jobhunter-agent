import Anthropic from '@anthropic-ai/sdk'
import Handlebars from 'handlebars'
import puppeteer from 'puppeteer'
import { z } from 'zod'
import { adminDb } from '../firebase-admin'
import logger from '../utils/logger'
import type { RawJob, UserProfile, MatchDetails } from '@/types'

const client = new Anthropic()

const skillCategorySchema = z.object({
  category: z.string(),
  skills: z.array(z.string()),
})

const cvContentSchema = z.object({
  summary: z.string(),
  skillCategories: z.array(skillCategorySchema),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      period: z.string(),
      bullets: z.array(z.string()),
      context: z.string(),
    })
  ),
  extras: z.array(z.string()).optional(),
})

type CVContent = z.infer<typeof cvContentSchema>

const CV_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.55; padding: 18mm 16mm; }
h1 { font-size: 18pt; font-weight: 700; letter-spacing: -0.01em; }
.contact { font-size: 9pt; color: #444; margin-top: 5px; }
h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #222; padding-bottom: 2px; margin: 13px 0 7px; }
p { margin-bottom: 4px; }
.exp-header { font-weight: 700; font-size: 10pt; margin-bottom: 3px; }
.exp-context { font-size: 9pt; color: #555; margin-top: 4px; margin-bottom: 8px; }
ul { padding-left: 13px; margin-bottom: 2px; }
li { margin-bottom: 2px; font-size: 9.5pt; }
.skill-row { margin-bottom: 2px; font-size: 9.5pt; }
.skill-label { font-weight: 700; }
.edu-row { margin-bottom: 3px; font-size: 9.5pt; }
.extras-list { padding-left: 13px; }
@page { margin: 0; size: A4; }
</style>
</head>
<body>

<h1>{{fullName}}</h1>
<div class="contact">{{email}}{{#if phone}} | {{phone}}{{/if}}{{#if linkedinUrl}} | {{linkedinUrl}}{{/if}}{{#if githubUrl}} | {{githubUrl}}{{/if}}</div>

<h2>Skills</h2>
{{#each skillCategories}}
<div class="skill-row"><span class="skill-label">{{category}}:</span> {{skills}}</div>
{{/each}}

<h2>Summary</h2>
<p>{{summary}}</p>

<h2>Experience</h2>
{{#each experiences}}
<div class="exp-header">{{company}} · {{role}} · {{period}}</div>
<ul>{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>
<div class="exp-context">{{context}}</div>
{{/each}}

<h2>Education</h2>
{{#each education}}
<div class="edu-row"><strong>{{course}}</strong> · {{institution}} · {{period}}</div>
{{/each}}

{{#if extras.length}}
<h2>Extras</h2>
<ul class="extras-list">{{#each extras}}<li>{{this}}</li>{{/each}}</ul>
{{/if}}

</body>
</html>`

function buildCVPrompt(profile: UserProfile, job: RawJob, matchDetails: MatchDetails): string {
  return `You are an expert resume writer and ATS optimization specialist.

Your task is to generate a tailored, ATS-friendly resume for the candidate below, customized for the target job.

========================
CRITICAL RULES
========================
1. DO NOT hallucinate or invent any information.
2. DO NOT invent skills, achievements, companies, or dates.
3. DO NOT exaggerate; use numbers only when they exist in the provided data.
4. The resume MUST fit within 2 pages maximum.
5. No tables, no columns, no icons, no graphics — plain linear structure only.
6. Prioritize keyword optimization and measurable impact.

========================
TARGET JOB
========================
Company: ${job.company}
Title: ${job.title}
Required stack: ${job.techStack.join(', ')}
Description: ${job.description.substring(0, 1500)}

${matchDetails.cvAdaptations.length > 0 ? `Adaptation hints: ${matchDetails.cvAdaptations.join(' | ')}` : ''}

========================
CANDIDATE PROFILE
========================
Name: ${profile.personal.fullName}
Current summary: ${profile.objective.professionalSummary}
Experiences: ${JSON.stringify(profile.experiences)}
Skills: ${JSON.stringify(profile.skills.technical)}
Education: ${JSON.stringify(profile.education)}
Certifications/extras: ${JSON.stringify([])}

========================
INSTRUCTIONS
========================
1. SKILLS: Group into categories (Languages, Frameworks, Databases, Tools, Testing). Only include categories that have real data from the profile. List the most job-relevant skills first within each category. Do not invent skills.
2. SUMMARY: Write 3–5 lines. Include: years of experience, main stack, 1–2 key achievements, industry/domain. Tailor to the target role.
3. EXPERIENCE: For each role, write 2–4 achievement-focused bullet points using action verbs and metrics when available. Then write a brief context paragraph (1–2 sentences) about the company, team/product context, and technologies used.
4. Keep only the most relevant experiences for this job if there are too many to fit 2 pages.
5. EXTRAS: Only include certifications or notable achievements if they exist in the profile data.

========================
OUTPUT FORMAT
========================
Return ONLY valid JSON, no comments, no explanation:

{
  "summary": "...",
  "skillCategories": [
    { "category": "Languages", "skills": ["TypeScript", "Python"] },
    { "category": "Frameworks", "skills": ["React", "Node.js"] }
  ],
  "experiences": [
    {
      "company": "...",
      "role": "...",
      "period": "Jan 2022 – Present",
      "bullets": ["Led migration of X resulting in 40% latency reduction", "..."],
      "context": "Company builds X product. Led a team of N engineers using TypeScript, React, and PostgreSQL."
    }
  ],
  "extras": ["AWS Certified Developer – Associate (2023)"]
}`
}

export async function generateCV(
  userId: string,
  jobId: string,
  job: RawJob,
  profile: UserProfile,
  matchDetails: MatchDetails
): Promise<{ pdfUrl: string; generatedAt: string }> {

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
    const highlighted = profile.skills.technical.filter((s) => job.techStack.includes(s.name)).map((s) => s.name)
    const other = profile.skills.technical.filter((s) => !job.techStack.includes(s.name)).map((s) => s.name)
    cvContent = {
      summary: profile.objective.professionalSummary,
      skillCategories: [
        ...(highlighted.length > 0 ? [{ category: 'Highlighted', skills: highlighted }] : []),
        ...(other.length > 0 ? [{ category: 'Other', skills: other }] : []),
      ],
      experiences: profile.experiences.map((e) => ({
        company: e.company,
        role: e.role,
        period: `${e.startDate} – ${e.endDate}`,
        bullets: e.description.split('.').filter(Boolean).slice(0, 4),
        context: e.stack.join(', '),
      })),
      extras: [],
    }
  }

  // Render HTML
  const template = Handlebars.compile(CV_TEMPLATE)
  const html = template({
    fullName: profile.personal.fullName,
    email: profile.personal.email,
    phone: profile.personal.phone,
    linkedinUrl: profile.personal.linkedinUrl,
    githubUrl: profile.personal.githubUrl,
    summary: cvContent.summary,
    skillCategories: cvContent.skillCategories.map((c) => ({
      category: c.category,
      skills: c.skills.join(', '),
    })),
    experiences: cvContent.experiences,
    education: profile.education.map((e) => ({
      course: e.course,
      institution: e.institution,
      period: `${e.startDate} – ${e.endDate}`,
    })),
    extras: cvContent.extras ?? [],
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

  const generatedAt = new Date().toISOString()
  const pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
  logger.info('cv_generated', { userId, jobId })

  return { pdfUrl, generatedAt }
}
