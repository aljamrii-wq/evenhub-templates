// Splits long text into page-sized chunks for the 576x288 text container.
//
// The character budget depends on font size and the amount of whitespace in
// your content. 400–500 chars/page is a safe default for default-font body
// text with natural word wrap. Tune `maxChars` against
// `skills/font-measurement` if you need a tighter fit.
//
// Breaks are preferred at paragraph boundaries, then sentences, then words —
// falling back to a hard cut only if a single word exceeds the budget.

export function paginate(text: string, maxChars: number): string[] {
  const pages: string[] = []
  let cursor = 0
  const trimmed = text.trim()

  while (cursor < trimmed.length) {
    const remaining = trimmed.length - cursor
    if (remaining <= maxChars) {
      pages.push(trimmed.slice(cursor).trim())
      break
    }

    const window = trimmed.slice(cursor, cursor + maxChars)
    const breakIdx = preferredBreak(window)
    const chunk = trimmed.slice(cursor, cursor + breakIdx).trim()
    pages.push(chunk)
    cursor += breakIdx
    while (trimmed[cursor] === ' ' || trimmed[cursor] === '\n') cursor++
  }

  return pages.filter(p => p.length > 0)
}

function preferredBreak(window: string): number {
  const paraBreak = window.lastIndexOf('\n\n')
  if (paraBreak > window.length * 0.5) return paraBreak + 2
  const sentenceBreak = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  )
  if (sentenceBreak > window.length * 0.5) return sentenceBreak + 2
  const spaceBreak = window.lastIndexOf(' ')
  if (spaceBreak > 0) return spaceBreak + 1
  return window.length
}
