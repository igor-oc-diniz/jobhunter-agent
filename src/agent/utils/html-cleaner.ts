import * as cheerio from 'cheerio'

export function cleanHtml(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, noscript, iframe').remove()
  return $('body').text().replace(/\s+/g, ' ').trim()
}

const TECH_KEYWORDS = [
  'React', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte', 'TypeScript',
  'JavaScript', 'HTML', 'CSS', 'Tailwind', 'SASS', 'Redux', 'GraphQL',
  'Node.js', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'Ruby', 'C#', '.NET',
  'Django', 'FastAPI', 'Spring', 'NestJS', 'Express',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'DynamoDB',
  'Elasticsearch', 'SQLite',
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'CI/CD', 'GitHub Actions', 'Jenkins',
  'React Native', 'Flutter', 'Swift', 'Kotlin',
  'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'Microservices',
]

export function extractTechStack(text: string): string[] {
  const normalized = text.toLowerCase()
  return TECH_KEYWORDS.filter((tech) =>
    new RegExp(`\\b${tech.toLowerCase().replace(/[.+]/g, '\\$&')}\\b`).test(normalized)
  )
}
