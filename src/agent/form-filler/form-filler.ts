import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb, adminStorage } from '../firebase-admin'
import { createBrowser, createPage, detectCaptcha } from '../utils/browser-pool'
import { humanDelay } from '../utils/human-delay'
import logger from '../utils/logger'
import type { Page } from 'playwright'
import type { RawJob, UserProfile } from '@/types'

const client = new Anthropic()

const SENSITIVE_LABELS = ['cpf', 'cnpj', 'senha', 'password', 'rg', 'passaporte', 'passport', 'banco', 'bank', 'saúde', 'health']

const formActionSchema = z.object({
  actions: z.array(
    z.object({
      selector: z.string(),
      type: z.enum(['fill', 'select', 'click', 'upload', 'skip']),
      value: z.string(),
      fieldDescription: z.string(),
    })
  ),
  submitSelector: z.string(),
  hasFileUpload: z.boolean(),
  estimatedFields: z.number(),
})

type FormActions = z.infer<typeof formActionSchema>

function hasSensitiveLabel(description: string): boolean {
  return SENSITIVE_LABELS.some((label) => description.toLowerCase().includes(label))
}

async function selectClosestOption(page: Page, selector: string, desiredValue: string): Promise<void> {
  try {
    const options = await page.locator(`${selector} option`).allTextContents()
    if (options.length === 0) return

    const lower = desiredValue.toLowerCase()
    const best = options.find((o) => o.toLowerCase().includes(lower)) ?? options[0]
    await page.selectOption(selector, { label: best })
  } catch {
    // ignore if select fails
  }
}

async function takeScreenshot(page: Page, userId: string, jobId: string, label: string): Promise<string | undefined> {
  try {
    const buffer = await page.screenshot({ fullPage: true })
    const path = `screenshots/${userId}/${jobId}-${label}.png`
    const file = adminStorage.bucket().file(path)
    await file.save(buffer, { contentType: 'image/png' })
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 3600000 })
    return url
  } catch {
    return undefined
  }
}

export async function fillAndSubmitForm(
  userId: string,
  jobId: string,
  job: RawJob,
  profile: UserProfile,
  cvFilePath: string,
  coverLetterText: string
): Promise<{ success: boolean; awaitingConfirmation: boolean; screenshotUrl?: string }> {
  const browser = await createBrowser()
  const page = await createPage(browser)

  try {
    await page.goto(job.sourceUrl, { waitUntil: 'networkidle', timeout: 30000 })
    await humanDelay()

    if (await detectCaptcha(page)) {
      const screenshotUrl = await takeScreenshot(page, userId, jobId, 'captcha')
      await createNotification(userId, jobId, 'captcha_detected', 'CAPTCHA detected', `CAPTCHA detected on ${job.company} form.`, screenshotUrl)
      return { success: false, awaitingConfirmation: false, screenshotUrl }
    }

    // Get simplified form HTML
    const formHtml = await page.evaluate(() => {
      const form = document.querySelector('form')
      return form ? form.outerHTML.substring(0, 4000) : document.body.innerHTML.substring(0, 4000)
    })

    // Ask Claude to map fields
    let actions: FormActions
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `You are a job application form filler agent.

Analyze the HTML form and the candidate profile, return a JSON with the required actions.

## CANDIDATE PROFILE
${JSON.stringify({
  fullName: profile.personal.fullName,
  email: profile.personal.email,
  phone: profile.personal.phone,
  city: profile.personal.city,
  linkedinUrl: profile.personal.linkedinUrl,
  desiredRole: profile.objective.desiredRole,
  contractType: profile.objective.contractType,
  salaryExpected: profile.objective.salaryMin,
  modality: profile.objective.modality,
  englishLevel: profile.skills.languages.find((l) => l.language.toLowerCase().includes('english') || l.language.toLowerCase().includes('inglês'))?.level,
})}

## JOB
Company: ${job.company}
Title: ${job.title}

## COVER LETTER
${coverLetterText.substring(0, 400)}

## FORM HTML
${formHtml}

## INSTRUCTIONS
For each interactive form field, return an action.
Action types: "fill" (text), "select" (dropdown), "click" (checkbox/radio), "upload" (file), "skip" (leave blank).
For open questions generate a 2-4 line contextual response for ${job.company}.

Return ONLY JSON:
{
  "actions": [{"selector":"<CSS selector>","type":"fill","value":"<value>","fieldDescription":"<what this field asks>"}],
  "submitSelector": "<submit button selector>",
  "hasFileUpload": true,
  "estimatedFields": 5
}`,
        }],
      })
      const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
      actions = formActionSchema.parse(JSON.parse(text))
    } catch (err) {
      logger.warn('form_mapping_error', { userId, jobId, error: String(err) })
      return { success: false, awaitingConfirmation: false }
    }

    // Check for sensitive fields
    const sensitiveActions = actions.actions.filter((a) => hasSensitiveLabel(a.fieldDescription))
    if (sensitiveActions.length > 0) {
      const screenshotUrl = await takeScreenshot(page, userId, jobId, 'sensitive')
      await createNotification(userId, jobId, 'awaiting_confirmation', 'Sensitive field detected',
        `Form for ${job.company} contains sensitive fields that require your attention.`, screenshotUrl)
      return { success: false, awaitingConfirmation: true, screenshotUrl }
    }

    // Execute fill actions
    for (const action of actions.actions) {
      await humanDelay(500, 1500)
      try {
        switch (action.type) {
          case 'fill':
            await page.fill(action.selector, action.value)
            break
          case 'select':
            await selectClosestOption(page, action.selector, action.value)
            break
          case 'click':
            await page.click(action.selector)
            break
          case 'upload':
            await page.setInputFiles(action.selector, cvFilePath)
            break
          case 'skip':
            break
        }
      } catch {
        logger.warn('field_fill_error', { selector: action.selector, type: action.type })
      }
    }

    const screenshotUrl = await takeScreenshot(page, userId, jobId, 'form-filled')

    // Semi-automatic: pause and wait for confirmation
    if (profile.agentConfig.mode === 'semi-automatic') {
      await adminDb.doc(`users/${userId}/applications/${jobId}`).set({
        status: 'awaiting_confirmation',
        formFilledAt: FieldValue.serverTimestamp(),
        formScreenshotUrl: screenshotUrl,
        awaitingConfirmationSince: FieldValue.serverTimestamp(),
      }, { merge: true })

      await createNotification(userId, jobId, 'awaiting_confirmation',
        'Application ready to submit',
        `The form for ${job.title} at ${job.company} is filled. Review and confirm.`,
        screenshotUrl)

      return { success: false, awaitingConfirmation: true, screenshotUrl }
    }

    // Automatic: submit
    await page.click(actions.submitSelector)
    await page.waitForTimeout(3000)

    const confirmationScreenshot = await takeScreenshot(page, userId, jobId, 'submitted')

    await adminDb.doc(`users/${userId}/applications/${jobId}`).set({
      status: 'applied',
      appliedAt: FieldValue.serverTimestamp(),
      formScreenshotUrl: confirmationScreenshot,
    }, { merge: true })

    // Add to blacklist
    await adminDb.collection(`users/${userId}/blacklist`).add({
      sourceUrl: job.sourceUrl,
      company: job.company,
      title: job.title,
      addedAt: FieldValue.serverTimestamp(),
      reason: 'applied',
    })

    logger.info('application_submitted', { userId, jobId })
    return { success: true, awaitingConfirmation: false, screenshotUrl: confirmationScreenshot }
  } finally {
    await browser.close()
  }
}

async function createNotification(
  userId: string,
  jobId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string
) {
  await adminDb.collection(`users/${userId}/notifications`).add({
    userId,
    type,
    title,
    message,
    read: false,
    relatedJobId: jobId,
    actionUrl: actionUrl ?? `/applications`,
    createdAt: FieldValue.serverTimestamp(),
  })
}
