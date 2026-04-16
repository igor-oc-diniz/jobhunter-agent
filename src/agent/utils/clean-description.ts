/**
 * Strips HTML tags, emojis, and normalizes whitespace from job descriptions.
 */
export function cleanDescription(raw: string): string {
  // Remove HTML tags
  let text = raw.replace(/<[^>]*>/g, ' ')

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')

  // Remove emoji characters (Unicode ranges)
  text = text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu,
    ''
  )

  // Normalize whitespace: collapse multiple spaces/newlines
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  return text
}
