import type { BaseScraper } from './base-scraper'
import { GupyScraper } from './gupy-scraper'
import { IndeedScraper } from './indeed-scraper'

const registry: Record<string, BaseScraper> = {
  gupy: new GupyScraper(),
  indeed: new IndeedScraper(),
}

export function getScraper(platform: string): BaseScraper | null {
  return registry[platform] ?? null
}

export function getEnabledScrapers(platforms: string[]): BaseScraper[] {
  return platforms.flatMap((p) => {
    const s = getScraper(p)
    return s ? [s] : []
  })
}
