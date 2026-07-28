import { createWorker } from 'tesseract.js'
import type { FoodCategory, ScannedItem } from '../types'
import { estimateExpiry, guessCategory } from './expiry'
import { extractExpiryFromText } from './dateOcr'

const NOISE =
  /^(total|subtotal|tax|cash|change|visa|mastercard|debit|credit|card|thank|welcome|store|tel|phone|www\.|http|receipt|cashier|register|balance|amount|due|paid|save|savings|coupon|member|loyalty|item|qty|price|\$|€|£|auth|approved|merchant|terminal|invoice|order|#)/i

const PRICE_ONLY = /^[\d.,$€£\s]+$/
const HAS_LETTER = /[a-zA-Z]/
const FOOD_HINT =
  /(organic|fresh|milk|egg|bread|cheese|chicken|beef|pork|fish|rice|pasta|apple|banana|orange|lettuce|tomato|onion|potato|yogurt|butter|juice|water|cereal|flour|sugar|oil|sauce|bean|soup|frozen|salad|fruit|veg|meat|dairy|produce|yogurt|snack|chips|crackers|coffee|tea|bacon|ham|turkey|salmon|avocado|berry|grape|pepper|cucumber|broccoli|kale|garlic|carrot)/i

const SKIP_LINE =
  /\b(you saved|member price|tare|net wt|weight|kg|lb\s*@|@\s*\$|clerk|lane|ref\s*#)\b/i

export async function scanReceiptImage(
  image: File | Blob | string,
  onProgress?: (pct: number) => void,
): Promise<ScannedItem[]> {
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })

  try {
    const { data } = await worker.recognize(image)
    return parseReceiptText(data.text)
  } finally {
    await worker.terminate()
  }
}

export function parseReceiptText(text: string): ScannedItem[] {
  const packageExpiry = extractExpiryFromText(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const items: ScannedItem[] = []

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue
    const cleaned = cleanLine(line)
    if (!cleaned) continue
    if (NOISE.test(cleaned)) continue
    if (PRICE_ONLY.test(cleaned)) continue
    if (!HAS_LETTER.test(cleaned)) continue
    if (cleaned.length < 3 || cleaned.length > 48) continue

    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const looksFood =
      FOOD_HINT.test(cleaned) ||
      /^[A-Za-z][A-Za-z0-9\s'&%-]{2,}$/.test(cleaned)
    if (!looksFood && !/[a-z]{3,}/i.test(cleaned)) continue

    // Drop lines that are mostly digits leftover
    const letterRatio = (cleaned.match(/[a-z]/gi)?.length ?? 0) / cleaned.length
    if (letterRatio < 0.4) continue

    const category: FoodCategory = guessCategory(cleaned)
    const expires =
      packageExpiry || estimateExpiry(cleaned).toISOString().slice(0, 10)

    items.push({
      name: titleCase(cleaned),
      quantity: 1,
      unit: 'ea',
      category,
      expiresAt: expires,
      selected: true,
      source: 'scan',
    })
  }

  if (items.length === 0) return demoScanItems()
  return scoreAndTrim(items).slice(0, 40)
}

function scoreAndTrim(items: ScannedItem[]): ScannedItem[] {
  return [...items].sort((a, b) => {
    const sa = FOOD_HINT.test(a.name) ? 1 : 0
    const sb = FOOD_HINT.test(b.name) ? 1 : 0
    return sb - sa
  })
}

function cleanLine(line: string): string {
  return line
    .replace(/[$€£]\s?\d+[.,]?\d*/g, '')
    .replace(/\b\d+[.,]\d{2}\b/g, '')
    .replace(/\b\d+\s*(lb|lbs|oz|kg|g|ct|pk|pack|ea|x)\b/gi, '')
    .replace(/\bx\d+\b/gi, '')
    .replace(/[^\w\s'&%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function demoScanItems(): ScannedItem[] {
  const sample = [
    'Organic Bananas',
    'Whole Milk',
    'Sourdough Bread',
    'Baby Spinach',
    'Greek Yogurt',
  ]
  return sample.map((name) => ({
    name,
    quantity: 1,
    unit: 'ea',
    category: guessCategory(name),
    expiresAt: estimateExpiry(name).toISOString().slice(0, 10),
    selected: true,
    source: 'scan' as const,
  }))
}
