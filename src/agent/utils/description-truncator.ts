import { cleanDescription } from './clean-description'

const MAX_CHARS = 2000

/**
 * Boilerplate patterns that add no signal for matching — remove these lines.
 */
const BOILERPLATE_PATTERNS = [
  /política\s+de\s+privacidade/gi,
  /lei\s+geral\s+de\s+proteção/gi,
  /\blgpd\b/gi,
  /equal\s+opportunity\s+employer/gi,
  /we\s+are\s+an\s+equal/gi,
  /somos\s+uma\s+empresa\s+que\s+valoriza\s+a\s+diversidade/gi,
  /candidates?\s+with\s+disabilities/gi,
  /pessoas\s+com\s+deficiência/gi,
]

/**
 * Keywords that mark the start of high-signal sections (requirements, responsibilities, stack).
 * When the text exceeds MAX_CHARS, we trim everything before the first occurrence of these.
 */
const PRIORITY_SECTION_KEYWORDS = [
  // PT
  'responsabilidades', 'o que você vai fazer', 'atividades',
  'requisitos', 'qualificações', 'o que buscamos', 'perfil desejado',
  'diferenciais', 'será um diferencial', 'stack', 'tecnologias',
  // EN
  'responsibilities', 'what you will do', 'requirements',
  'qualifications', 'what we are looking for', 'nice to have',
  'tech stack', 'technologies',
]

function findPrioritySectionStart(text: string): number {
  const lower = text.toLowerCase()
  let earliest = -1

  for (const keyword of PRIORITY_SECTION_KEYWORDS) {
    const idx = lower.indexOf(keyword)
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx
    }
  }

  return earliest
}

/**
 * Strips HTML, removes boilerplate, and trims to MAX_CHARS prioritising
 * requirement/responsibility sections.
 *
 * @returns Clean text, at most 2000 chars. Never throws.
 */
export function truncateDescription(rawHtml: string): string {
  // 1. Strip HTML, emojis, collapse whitespace
  let text = cleanDescription(rawHtml)

  // 2. Remove lines that match boilerplate patterns
  const lines = text.split('\n')
  const filtered = lines.filter(
    (line) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line))
  )
  text = filtered.join('\n').trim()

  // 3. Already within limit — done
  if (text.length <= MAX_CHARS) return text

  // 4. Try to start from the first high-signal section
  const priorityStart = findPrioritySectionStart(text)
  if (priorityStart > 0) {
    text = text.substring(priorityStart).trim()
  }

  // 5. Hard-truncate with indicator
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS - 50).trimEnd() + '\n[descrição truncada]'
  }

  return text
}
