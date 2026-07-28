import type { FoodCategory, ScannedItem } from '../types'
import { estimateExpiry, guessCategory } from './expiry'
import { extractExpiryFromText } from './dateOcr'
import { enrichScannedItem } from './groceryMatch'
import { recognizeText } from './ocr'

const NOISE =
  /^(total|subtotal|tax|cash|change|visa|mastercard|debit|credit|card|thank|welcome|store|tel|phone|www\.|http|receipt|cashier|register|balance|amount|due|paid|save|savings|coupon|member|loyalty|item|qty|price|\$|€|£|auth|approved|merchant|terminal|invoice|order|#|date|time)/i

const PRICE_ONLY = /^[\d.,$€£\s]+$/
const HAS_LETTER = /[a-zA-Z]/
const FOOD_HINT =
  /(organic|fresh|milk|egg|bread|cheese|chicken|beef|pork|fish|rice|pasta|apple|banana|orange|lettuce|tomato|onion|potato|yogurt|butter|juice|water|cereal|flour|sugar|oil|sauce|bean|soup|frozen|salad|fruit|veg|meat|dairy|produce|snack|chips|crackers|coffee|tea|bacon|ham|turkey|salmon|avocado|berry|grape|pepper|cucumber|broccoli|kale|garlic|carrot|shrimp|pasta|oat)/i

const SKIP_LINE =
  /\b(you saved|member price|tare|net wt|weight|kg|lb\s*@|@\s*\$|clerk|lane|ref\s*#)\b/i

const QTY_PREFIX = /^(?:(\d+)\s*[xX×]\s*|\((\d+)\)\s*)/
const QTY_SUFFIX = /\s+[xX×]\s*(\d+)\s*$/

export async function scanReceiptImage(
  image: File | Blob | string,
  onProgress?: (pct: number) => void,
): Promise<ScannedItem[]> {
  const text = await recognizeText(image, onProgress)
  return parseReceiptText(text)
}

/** Scan several receipt photos and merge into one grocery list. */
export async function scanReceiptImages(
  images: Array<File | Blob>,
  onProgress?: (pct: number) => void,
): Promise<ScannedItem[]> {
  if (!images.length) return []
  const merged = new Map<string, ScannedItem>()
  for (let i = 0; i < images.length; i++) {
    const base = Math.round((i / images.length) * 100)
    const items = await scanReceiptImage(images[i], (p) => {
      onProgress?.(Math.min(99, base + Math.round(p / images.length)))
    })
    for (const item of items) {
      const key = item.name.toLowerCase()
      const existing = merged.get(key)
      if (existing) existing.quantity += item.quantity
      else merged.set(key, { ...item })
    }
  }
  onProgress?.(100)
  return [...merged.values()]
}

export function parseReceiptText(text: string): ScannedItem[] {
  const packageExpiry = extractExpiryFromText(text)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const seen = new Map<string, ScannedItem>()

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue
    const { name: rawName, quantity } = extractQuantity(line)
    const cleaned = cleanLine(rawName)
    if (!cleaned) continue
    if (NOISE.test(cleaned)) continue
    if (PRICE_ONLY.test(cleaned)) continue
    if (!HAS_LETTER.test(cleaned)) continue
    if (cleaned.length < 3 || cleaned.length > 48) continue

    const letterRatio = (cleaned.match(/[a-z]/gi)?.length ?? 0) / cleaned.length
    if (letterRatio < 0.4) continue

    const looksFood =
      FOOD_HINT.test(cleaned) || /^[A-Za-z][A-Za-z0-9\s'&%-]{2,}$/.test(cleaned)
    if (!looksFood && !/[a-z]{3,}/i.test(cleaned)) continue

    let item: ScannedItem = {
      name: cleaned,
      quantity,
      unit: 'ea',
      category: guessCategory(cleaned) as FoodCategory,
      expiresAt: packageExpiry || estimateExpiry(cleaned).toISOString().slice(0, 10),
      selected: true,
      source: 'scan',
    }
    item = enrichScannedItem(item)

    const key = item.name.toLowerCase()
    const existing = seen.get(key)
    if (existing) existing.quantity += item.quantity
    else seen.set(key, item)
  }

  const items = [...seen.values()]
  if (items.length === 0) return demoScanItems()
  return scoreAndTrim(items).slice(0, 50)
}

function extractQuantity(line: string): { name: string; quantity: number } {
  let quantity = 1
  let name = line
  const pre = line.match(QTY_PREFIX)
  if (pre) {
    quantity = Number(pre[1] || pre[2] || 1)
    name = line.slice(pre[0].length)
  } else {
    const suf = line.match(QTY_SUFFIX)
    if (suf) {
      quantity = Number(suf[1] || 1)
      name = line.slice(0, suf.index)
    }
  }
  return { name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1 }
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
    .replace(/\b\d+\s*(lb|lbs|oz|kg|g|ct|pk|pack|ea)\b/gi, '')
    .replace(/\bx\d+\b/gi, '')
    .replace(/[^\w\s'&%-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function demoScanItems(): ScannedItem[] {
  const sample = [
    'Organic Bananas',
    'Whole Milk',
    'Sourdough Bread',
    'Baby Spinach',
    'Greek Yogurt',
  ]
  return sample.map((name) =>
    enrichScannedItem({
      name,
      quantity: 1,
      unit: 'ea',
      category: guessCategory(name),
      expiresAt: estimateExpiry(name).toISOString().slice(0, 10),
      selected: true,
      source: 'scan',
    }),
  )
}
