/**
 * Extracts known tech stack keywords from a free-text job description.
 * Uses word-boundary regex to avoid false positives (e.g. "rust" inside "trust").
 */

const TECH_KEYWORDS = [
  // Frontend
  'React', 'Vue', 'Angular', 'Next.js', 'Nuxt', 'Svelte', 'TypeScript',
  'JavaScript', 'HTML', 'CSS', 'Tailwind', 'SASS', 'Redux', 'GraphQL',
  // Backend
  'Node.js', 'Python', 'Java', 'Go', 'Rust', 'PHP', 'Ruby', 'C#', '.NET',
  'Django', 'FastAPI', 'Spring', 'NestJS', 'Express',
  // Database
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'DynamoDB',
  'Elasticsearch', 'SQLite',
  // Cloud / DevOps
  'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform',
  'CI/CD', 'GitHub Actions', 'Jenkins',
  // Mobile
  'React Native', 'Flutter', 'Swift', 'Kotlin',
  // Other
  'REST', 'gRPC', 'Kafka', 'RabbitMQ', 'Microservices',
]

export function extractTechStack(text: string): string[] {
  const normalized = text.toLowerCase()
  return TECH_KEYWORDS.filter((tech) => {
    const escaped = tech.toLowerCase().replace(/[.+]/g, (c) => `\\${c}`)
    return new RegExp(`\\b${escaped}\\b`).test(normalized)
  })
}
