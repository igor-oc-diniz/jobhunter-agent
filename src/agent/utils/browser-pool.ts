import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import type { Browser, Page } from 'playwright'

chromium.use(StealthPlugin())

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
]

export async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  }) as unknown as Browser
}

export async function createPage(browser: Browser): Promise<Page> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  const context = await browser.newContext({
    userAgent: ua,
    viewport: { width: 1280, height: 720 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  return context.newPage()
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const selectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.cf-challenge-running',
    '#challenge-form',
    '[data-sitekey]',
  ]
  for (const sel of selectors) {
    if (await page.locator(sel).count() > 0) return true
  }
  return false
}
