import { createLogger } from '../utils/logger'
import { GupyScraper } from './gupy-scraper'
import { IndeedBRScraper } from './indeed-br-scraper'
import type { BaseScraper } from './base-scraper'
import type { ScraperConfig } from '@/types/scraper'

const DEFAULT_CONFIGS: Record<string, ScraperConfig> = {
  gupy: { platform: 'gupy', enabled: true, maxJobsPerRun: 50, timeout: 60000 },
  'indeed-br': { platform: 'indeed-br', enabled: true, maxJobsPerRun: 30, timeout: 30000 },
}

function createScraper(platform: string): BaseScraper | null {
  const config = DEFAULT_CONFIGS[platform]
  if (!config) return null
  const logger = createLogger(`scraper:${platform}`)
  switch (platform) {
    case 'gupy':
      return new GupyScraper(config, logger)
    case 'indeed-br':
      return new IndeedBRScraper(config, logger)
    default:
      return null
  }
}

export function getScraper(platform: string): BaseScraper | null {
  return createScraper(platform)
}

export function getEnabledScrapers(platforms: string[]): BaseScraper[] {
  return platforms.flatMap((p) => {
    const s = createScraper(p)
    return s ? [s] : []
  })
}
