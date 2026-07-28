import { createWorker } from 'tesseract.js'
import { addDays, format, isValid, parse } from 'date-fns'

const DATE_PATTERNS: { re: RegExp; fmt: string }[] = [
  { re: /\b(\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/, fmt: 'yyyy-M-d' },
  { re: /\b(\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/, fmt: 'M-d-yyyy' },
  { re: /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2})\b/, fmt: 'M-d-yy' },
  { re: /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/, fmt: 'd MMMM yyyy' },
  { re: /\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\b/, fmt: 'd MMM yyyy' },
  { re: /\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/, fmt: 'MMMM d yyyy' },
]

const EXPIRY_HINT =
  /(best\s*before|use\s*by|exp(?:iry|ires)?|bb|bbe|sell\s*by|best\s*by)/i

/** Pull a likely expiry date from package / label OCR text. */
export function extractExpiryFromText(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nearby = `${line} ${lines[i + 1] ?? ''}`
    if (!EXPIRY_HINT.test(nearby) && !EXPIRY_HINT.test(line)) continue
    const found = parseDateCandidate(nearby) || parseDateCandidate(line)
    if (found) return found
  }

  // Fallback: any date in the next 2 years window
  for (const line of lines) {
    const found = parseDateCandidate(line)
    if (found) {
      const d = new Date(found)
      const now = new Date()
      if (d >= addDays(now, -30) && d <= addDays(now, 730)) return found
    }
  }
  return null
}

export async function scanPackageForExpiry(
  image: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<{ text: string; expiresAt: string | null }> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return { text: data.text, expiresAt: extractExpiryFromText(data.text) }
  } finally {
    await worker.terminate()
  }
}

function parseDateCandidate(text: string): string | null {
  const normalized = text.replace(/[./]/g, '-').replace(/\s+/g, ' ')
  for (const { re, fmt } of DATE_PATTERNS) {
    const match = normalized.match(re) || text.match(re)
    if (!match) continue
    let raw = match[1]
    let useFmt = fmt
    if (fmt === 'd MMM yyyy' && /\b\d{2}$/.test(raw)) {
      raw = raw.replace(/\b(\d{2})$/, '20$1')
    }
    if (fmt === 'M-d-yy') {
      const parts = raw.split('-')
      if (parts[2]?.length === 2) parts[2] = `20${parts[2]}`
      raw = parts.join('-')
      useFmt = 'M-d-yyyy'
    }
    const parsed = parse(raw, useFmt === 'MMMM d yyyy' ? tryFmt(raw) : useFmt, new Date())
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
  }
  return null
}

function tryFmt(raw: string): string {
  return /[A-Za-z]{4,}/.test(raw) ? 'MMMM d yyyy' : 'MMM d yyyy'
}
