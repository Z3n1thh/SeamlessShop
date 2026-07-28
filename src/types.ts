export type FoodCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'beverage'
  | 'other'

export type ExpiryStatus = 'fresh' | 'soon' | 'urgent' | 'expired'

export type ItemSource = 'manual' | 'scan' | 'barcode' | 'package'

export interface PantryItem {
  id: string
  name: string
  quantity: number
  unit: string
  category: FoodCategory
  purchasedAt: string
  expiresAt: string
  notes?: string
  source: ItemSource
  barcode?: string
  updatedAt: string
}

export interface ScannedItem {
  name: string
  quantity: number
  unit: string
  category: FoodCategory
  expiresAt: string
  selected: boolean
  barcode?: string
  source?: ItemSource
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: number
  unit: string
  checked: boolean
  fromRecipe?: string
  createdAt: string
}

export type WasteOutcome = 'used' | 'thrown'

export interface WasteEvent {
  id: string
  name: string
  category: FoodCategory
  outcome: WasteOutcome
  quantity: number
  unit: string
  at: string
  wasExpired: boolean
}

export interface Recipe {
  id: string
  title: string
  image: string
  ingredients: string[]
  matched: string[]
  missing: string[]
  instructions: string
  sourceUrl?: string
}

export type AppView = 'pantry' | 'scan' | 'shop' | 'recipes' | 'more'
