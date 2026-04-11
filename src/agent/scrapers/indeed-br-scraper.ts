import axios, { type AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'
import { BaseScraper } from './base-scraper'
import type { RawJobInput } from '@/types/scraper'

export class IndeedBRScraper extends BaseScraper {
  private axiosInstance: AxiosInstance

  constructor(...args: ConstructorParameters<typeof BaseScraper>) {
    super(...args)

    // Create axios instance with configuration
    this.axiosInstance = axios.create({
      timeout: this.config.timeout || 30000,
      headers: {
        'User-Agent': this.config.userAgent || 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    })
  }

  /**
   * Scrape jobs from Indeed Brazil using static HTML parsing
   */
  async scrape(): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    try {
      // Indeed Brazil search URL for tech jobs
      // In production, these parameters should be configurable
      const searchParams = new URLSearchParams({
        q: 'desenvolvedor',
        l: 'Brasil',
        sort: 'date',
        fromage: '7', // Last 7 days
      })

      const baseUrl = 'https://br.indeed.com/jobs'
      const searchUrl = `${baseUrl}?${searchParams.toString()}`

      this.logger.info('Fetching Indeed Brazil jobs', { url: searchUrl })

      let currentPage = 0
      const maxPages = Math.ceil(this.config.maxJobsPerRun / 15) // Indeed shows ~15 jobs per page

      while (jobs.length < this.config.maxJobsPerRun && currentPage < maxPages) {
        const pageUrl = currentPage === 0 
          ? searchUrl 
          : `${searchUrl}&start=${currentPage * 10}`

        try {
          const response = await this.axiosInstance.get(pageUrl)
          const pageJobs = await this.parseJobsFromHTML(response.data, baseUrl)

          if (pageJobs.length === 0) {
            this.logger.info('No more jobs found on page', { page: currentPage })
            break
          }

          jobs.push(...pageJobs)
          this.logger.debug(`Collected ${jobs.length} jobs from ${currentPage + 1} pages`)

          currentPage++

          // Add delay between requests to be respectful
          if (currentPage < maxPages && jobs.length < this.config.maxJobsPerRun) {
            await this.delay(2000)
          }
        } catch (error) {
          this.logger.error('Failed to fetch page', {
            page: currentPage,
            error: (error as Error).message,
          })
          break
        }
      }

      this.logger.info('Indeed BR scraping completed', { totalJobs: jobs.length })

      // Return only up to maxJobsPerRun
      return jobs.slice(0, this.config.maxJobsPerRun)
    } catch (error) {
      this.logger.error('Indeed BR scraping failed', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      })
      return []
    }
  }

  /**
   * Parse jobs from Indeed HTML response
   */
  private async parseJobsFromHTML(html: string, baseUrl: string): Promise<RawJobInput[]> {
    const jobs: RawJobInput[] = []

    try {
      const $ = cheerio.load(html)

      // Indeed uses various class names, we'll try multiple selectors
      const jobCards = $('.job_seen_beacon, .jobsearch-SerpJobCard, div[data-jk]')

      this.logger.debug(`Found ${jobCards.length} job cards in HTML`)

      jobCards.each((index, element) => {
        try {
          const $card = $(element)

          // Extract job ID
          const jobId = $card.attr('data-jk') || 
                       $card.find('[data-jk]').attr('data-jk') ||
                       $card.attr('id')

          if (!jobId) {
            return // Skip if no ID found
          }

          // Extract title
          const $title = $card.find('h2.jobTitle, .jobTitle span, a[data-jk]').first()
          const title = $title.text().trim()

          if (!title) {
            return // Skip if no title
          }

          // Extract company
          const $company = $card.find('.companyName, [data-testid="company-name"]').first()
          const company = $company.text().trim() || 'Unknown'

          // Extract location
          const $location = $card.find('.companyLocation, [data-testid="text-location"]').first()
          const location = $location.text().trim() || 'Remote'

          // Build job URL
          const url = `https://br.indeed.com/viewjob?jk=${jobId}`

          // Extract salary if available
          const $salary = $card.find('.salary-snippet, .salaryText, [data-testid="attribute_snippet_testid"]').first()
          const salary = $salary.text().trim() || undefined

          // Extract job snippet/description
          const $snippet = $card.find('.job-snippet, [data-testid="job-snippet"]').first()
          const description = $snippet.text().trim() || title

          // Extract employment type
          const $metadata = $card.find('.metadata, .jobMetaDataGroup')
          const metadataText = $metadata.text()
          let employmentType: string | undefined

          if (metadataText.includes('Tempo integral') || metadataText.includes('Full-time')) {
            employmentType = 'Full-time'
          } else if (metadataText.includes('Meio período') || metadataText.includes('Part-time')) {
            employmentType = 'Part-time'
          } else if (metadataText.includes('Contrato') || metadataText.includes('Contract')) {
            employmentType = 'Contract'
          }

          // Extract posted date
          const $date = $card.find('.date, [data-testid="myJobsStateDate"]').first()
          const postedDate = $date.text().trim() || undefined

          // Extract skills from description
          const requiredSkills = this.extractSkillsFromText(description)

          jobs.push({
            externalId: jobId,
            platform: 'indeed-br',
            title,
            company,
            location,
            url,
            description,
            salary,
            employmentType,
            postedDate,
            requiredSkills,
            scrapedAt: new Date(),
          })
        } catch (error) {
          this.logger.warn('Failed to parse job card', {
            error: (error as Error).message,
          })
        }
      })
    } catch (error) {
      this.logger.error('Failed to parse HTML', {
        error: (error as Error).message,
      })
    }

    return jobs
  }

  /**
   * Extract common tech skills from job description text
   */
  private extractSkillsFromText(text: string): string[] {
    const skills: string[] = []
    const lowerText = text.toLowerCase()

    // Common tech skills to look for
    const skillPatterns = [
      'javascript', 'typescript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust',
      'react', 'angular', 'vue', 'node.js', 'next.js', 'express',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'git', 'ci/cd', 'agile', 'scrum',
    ]

    for (const skill of skillPatterns) {
      if (lowerText.includes(skill)) {
        skills.push(skill)
      }
    }

    // Remove duplicates using Array.from instead of spread
    return Array.from(new Set(skills))
  }

  /**
   * Delay helper for respectful scraping
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
