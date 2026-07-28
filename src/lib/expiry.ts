import type { FoodCategory, ExpiryStatus, PantryItem } from '../types'
import { differenceInCalendarDays, parseISO } from 'date-fns'

/** Typical fridge/pantry shelf life in days after purchase. */
export const SHELF_LIFE_DAYS: Record<string, number> = {
  milk: 7,
  yogurt: 14,
  cheese: 21,
  butter: 30,
  eggs: 21,
  bread: 5,
  banana: 5,
  apple: 21,
  orange: 14,
  lemon: 21,
  lettuce: 7,
  spinach: 5,
  tomato: 7,
  potato: 21,
  onion: 30,
  garlic: 60,
  carrot: 21,
  chicken: 3,
  beef: 4,
  pork: 4,
  fish: 2,
  salmon: 2,
  shrimp: 2,
  bacon: 7,
  sausage: 7,
  ham: 7,
  rice: 365,
  pasta: 365,
  flour: 180,
  sugar: 730,
  oil: 365,
  cereal: 180,
  juice: 10,
}

export const CATEGORY_SHELF_LIFE: Record<FoodCategory, number> = {
  produce: 7,
  dairy: 10,
  meat: 3,
  seafood: 2,
  bakery: 5,
  pantry: 180,
  frozen: 90,
  beverage: 14,
  other: 14,
}

export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  seafood: 'Seafood',
  bakery: 'Bakery',
  pantry: 'Pantry',
  frozen: 'Frozen',
  beverage: 'Beverage',
  other: 'Other',
}

export function guessCategory(name: string): FoodCategory {
  const n = name.toLowerCase()
  if (/(milk|yogurt|cheese|butter|cream|egg)/.test(n)) return 'dairy'
  if (/(chicken|beef|pork|turkey|bacon|sausage|ham|lamb|meat)/.test(n)) return 'meat'
  if (/(fish|salmon|shrimp|tuna|cod|seafood|crab)/.test(n)) return 'seafood'
  if (/(bread|bagel|muffin|croissant|bun|bagel|roll)/.test(n)) return 'bakery'
  if (/(frozen|ice cream)/.test(n)) return 'frozen'
  if (/(juice|soda|water|coffee|tea|drink|beverage)/.test(n)) return 'beverage'
  if (/(rice|pasta|flour|sugar|oil|cereal|bean|lentil|spice|salt|sauce|can)/.test(n))
    return 'pantry'
  if (
    /(apple|banana|orange|lemon|lettuce|spinach|tomato|potato|onion|garlic|carrot|berry|grape|pepper|cucumber|avocado|broccoli|kale)/.test(
      n,
    )
  )
    return 'produce'
  return 'other'
}

export function estimateExpiry(name: string, purchasedAt = new Date()): Date {
  const lower = name.toLowerCase()
  let days = CATEGORY_SHELF_LIFE[guessCategory(name)]
  for (const [key, value] of Object.entries(SHELF_LIFE_DAYS)) {
    if (lower.includes(key)) {
      days = value
      break
    }
  }
  const expires = new Date(purchasedAt)
  expires.setDate(expires.getDate() + days)
  return expires
}

export function daysUntilExpiry(expiresAt: string, now = new Date()): number {
  return differenceInCalendarDays(parseISO(expiresAt), now)
}

export function getExpiryStatus(expiresAt: string, now = new Date()): ExpiryStatus {
  const days = daysUntilExpiry(expiresAt, now)
  if (days < 0) return 'expired'
  if (days <= 1) return 'urgent'
  if (days <= 3) return 'soon'
  return 'fresh'
}

export function statusLabel(status: ExpiryStatus, days: number): string {
  if (status === 'expired') return `Expired ${Math.abs(days)}d ago`
  if (status === 'urgent') return days === 0 ? 'Expires today' : 'Expires tomorrow'
  if (status === 'soon') return `${days} days left`
  return `${days} days left`
}

export function sortByExpiry(items: PantryItem[]): PantryItem[] {
  return [...items].sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
  )
}
