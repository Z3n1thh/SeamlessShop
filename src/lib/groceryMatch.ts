import type { FoodCategory, ScannedItem } from '../types'
import { estimateExpiry, guessCategory } from './expiry'

/** Canonical grocery names for fuzzy OCR matching. */
const GROCERY_CATALOG: { name: string; aliases: string[]; category?: FoodCategory }[] = [
  { name: 'Milk', aliases: ['whole milk', '2% milk', 'skim milk', 'mlk', 'milk 1gal', 'organic milk'], category: 'dairy' },
  { name: 'Eggs', aliases: ['egg', 'lg eggs', 'large eggs', 'egg dozen', 'cage free eggs'], category: 'dairy' },
  { name: 'Butter', aliases: ['unsalted butter', 'salted butter', 'butter sticks'], category: 'dairy' },
  { name: 'Cheese', aliases: ['cheddar', 'cheddar cheese', 'mozarella', 'mozzarella', 'swiss cheese', 'string cheese'], category: 'dairy' },
  { name: 'Yogurt', aliases: ['greek yogurt', 'yoghurt', 'plain yogurt', 'yogurt cup'], category: 'dairy' },
  { name: 'Bread', aliases: ['wheat bread', 'white bread', 'sourdough', 'sourdough bread', 'loaf'], category: 'bakery' },
  { name: 'Bananas', aliases: ['banana', 'organic bananas', 'bnna'], category: 'produce' },
  { name: 'Apples', aliases: ['apple', 'gala apples', 'honeycrisp', 'fuji apple'], category: 'produce' },
  { name: 'Oranges', aliases: ['orange', 'navel orange', 'citrus'], category: 'produce' },
  { name: 'Spinach', aliases: ['baby spinach', 'fresh spinach', 'leafy spinach'], category: 'produce' },
  { name: 'Lettuce', aliases: ['romaine', 'iceberg', 'salad mix', 'spring mix'], category: 'produce' },
  { name: 'Tomatoes', aliases: ['tomato', 'roma tomato', 'grape tomato', 'cherry tomato'], category: 'produce' },
  { name: 'Onions', aliases: ['onion', 'yellow onion', 'red onion', 'white onion'], category: 'produce' },
  { name: 'Garlic', aliases: ['garlic bulb', 'fresh garlic'], category: 'produce' },
  { name: 'Potatoes', aliases: ['potato', 'russet', 'russet potato', 'yukon gold'], category: 'produce' },
  { name: 'Carrots', aliases: ['carrot', 'baby carrots'], category: 'produce' },
  { name: 'Avocados', aliases: ['avocado', 'hass avocado'], category: 'produce' },
  { name: 'Chicken', aliases: ['chicken breast', 'chicken thighs', 'rotisserie', 'whole chicken'], category: 'meat' },
  { name: 'Beef', aliases: ['ground beef', 'beef steak', 'stew meat', 'sirloin'], category: 'meat' },
  { name: 'Pork', aliases: ['pork chop', 'pork loin', 'bacon', 'ham'], category: 'meat' },
  { name: 'Turkey', aliases: ['ground turkey', 'turkey breast', 'deli turkey'], category: 'meat' },
  { name: 'Salmon', aliases: ['atlantic salmon', 'salmon fillet', 'smoked salmon'], category: 'seafood' },
  { name: 'Shrimp', aliases: ['prawns', 'raw shrimp', 'cooked shrimp'], category: 'seafood' },
  { name: 'Rice', aliases: ['white rice', 'brown rice', 'jasmine rice', 'basmati'], category: 'pantry' },
  { name: 'Pasta', aliases: ['spaghetti', 'penne', 'macaroni', 'noodles'], category: 'pantry' },
  { name: 'Cereal', aliases: ['oats', 'oatmeal', 'granola', 'cheerios'], category: 'pantry' },
  { name: 'Olive Oil', aliases: ['oil', 'vegetable oil', 'cooking oil', 'evoo'], category: 'pantry' },
  { name: 'Juice', aliases: ['orange juice', 'apple juice', 'oj'], category: 'beverage' },
  { name: 'Coffee', aliases: ['ground coffee', 'coffee beans', 'k cup'], category: 'beverage' },
  { name: 'Water', aliases: ['bottled water', 'sparkling water', 'seltzer'], category: 'beverage' },
  { name: 'Frozen Vegetables', aliases: ['frozen veggies', 'frozen peas', 'mixed vegetables'], category: 'frozen' },
  { name: 'Ice Cream', aliases: ['icecream', 'gelato', 'frozen dessert'], category: 'frozen' },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(' ').filter((t) => t.length > 1))
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let hit = 0
  for (const t of a) if (b.has(t)) hit++
  return hit / Math.max(a.size, b.size)
}

/** Map messy OCR text to a clean grocery name when possible. */
export function matchGroceryName(raw: string): {
  name: string
  category: FoodCategory
  matched: boolean
  confidence: number
} {
  const n = normalize(raw)
  const rawTokens = tokenSet(raw)

  let best: { name: string; category: FoodCategory; score: number } | null = null

  for (const entry of GROCERY_CATALOG) {
    const candidates = [entry.name, ...entry.aliases]
    for (const c of candidates) {
      const cn = normalize(c)
      if (n === cn || n.includes(cn) || cn.includes(n)) {
        const score = n === cn ? 1 : 0.92
        if (!best || score > best.score) {
          best = {
            name: entry.name,
            category: entry.category ?? guessCategory(entry.name),
            score,
          }
        }
        continue
      }
      const score = overlapScore(rawTokens, tokenSet(c))
      if (score >= 0.6 && (!best || score > best.score)) {
        best = {
          name: entry.name,
          category: entry.category ?? guessCategory(entry.name),
          score,
        }
      }
    }
  }

  if (best && best.score >= 0.6) {
    return { name: best.name, category: best.category, matched: true, confidence: best.score }
  }

  return {
    name: titleCase(raw),
    category: guessCategory(raw),
    matched: false,
    confidence: 0.4,
  }
}

/** Fuzzy-match against existing pantry names (merge duplicates). */
export function findPantryMatch(
  name: string,
  pantryNames: string[],
): string | null {
  const target = normalize(name)
  const targetTokens = tokenSet(name)

  for (const existing of pantryNames) {
    const e = normalize(existing)
    if (e === target) return existing
    if (e.includes(target) || target.includes(e)) return existing
    if (overlapScore(targetTokens, tokenSet(existing)) >= 0.75) return existing
  }
  return null
}

export function enrichScannedItem(item: ScannedItem): ScannedItem & { matchedCatalog: boolean } {
  const matched = matchGroceryName(item.name)
  return {
    ...item,
    name: matched.name,
    category: matched.category,
    expiresAt: estimateExpiry(matched.name).toISOString().slice(0, 10),
    matchedCatalog: matched.matched,
  }
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
