import type { FoodCategory, ShoppingItem } from '../types'
import { guessCategory } from './expiry'

/** Store aisle order for smarter shopping. */
export const AISLE_ORDER = [
  'Produce',
  'Bakery',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Frozen',
  'Pantry',
  'Beverages',
  'Other',
] as const

export type Aisle = (typeof AISLE_ORDER)[number]

const CATEGORY_AISLE: Record<FoodCategory, Aisle> = {
  produce: 'Produce',
  bakery: 'Bakery',
  meat: 'Meat & Seafood',
  seafood: 'Meat & Seafood',
  dairy: 'Dairy & Eggs',
  frozen: 'Frozen',
  pantry: 'Pantry',
  beverage: 'Beverages',
  other: 'Other',
}

export function aisleForItem(name: string, category?: FoodCategory): Aisle {
  return CATEGORY_AISLE[category ?? guessCategory(name)]
}

export function groupShoppingByAisle(
  items: ShoppingItem[],
): { aisle: Aisle; items: ShoppingItem[] }[] {
  const map = new Map<Aisle, ShoppingItem[]>()
  for (const item of items) {
    const aisle = aisleForItem(item.name)
    const list = map.get(aisle) ?? []
    list.push(item)
    map.set(aisle, list)
  }
  return AISLE_ORDER.filter((a) => map.has(a)).map((aisle) => ({
    aisle,
    items: map.get(aisle)!,
  }))
}
