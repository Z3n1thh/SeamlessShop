import type { PantryItem, ShoppingItem, WasteEvent } from '../types'

const PANTRY_KEY = 'seamlessshop-pantry-v1'
const SETTINGS_KEY = 'seamlessshop-settings-v1'
const SHOP_KEY = 'seamlessshop-shop-v1'
const WASTE_KEY = 'seamlessshop-waste-v1'

export interface AppSettings {
  alertDays: number
  notificationsEnabled: boolean
  syncEmail: string
  householdId: string
  householdName: string
  householdInvite: string
  theme: 'light' | 'dark' | 'system'
}

const DEFAULT_SETTINGS: AppSettings = {
  alertDays: 3,
  notificationsEnabled: false,
  syncEmail: '',
  householdId: '',
  householdName: '',
  householdInvite: '',
  theme: 'system',
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadItems(): PantryItem[] {
  const items = readJson<PantryItem[] | null>(PANTRY_KEY, null)
  if (!items) return seedDemoItems()
  return items.map(normalizeItem)
}

export function saveItems(items: PantryItem[]): void {
  localStorage.setItem(PANTRY_KEY, JSON.stringify(items))
}

export function loadShopping(): ShoppingItem[] {
  return readJson(SHOP_KEY, [])
}

export function saveShopping(items: ShoppingItem[]): void {
  localStorage.setItem(SHOP_KEY, JSON.stringify(items))
}

export function loadWaste(): WasteEvent[] {
  return readJson(WASTE_KEY, [])
}

export function saveWaste(events: WasteEvent[]): void {
  localStorage.setItem(WASTE_KEY, JSON.stringify(events))
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}) }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function normalizeItem(item: PantryItem): PantryItem {
  return {
    ...item,
    updatedAt: item.updatedAt ?? nowIso(),
    source: item.source ?? 'manual',
  }
}

export function createItem(
  partial: Omit<PantryItem, 'id' | 'updatedAt'> & { id?: string; updatedAt?: string },
): PantryItem {
  return {
    id: partial.id ?? uid(),
    name: partial.name.trim(),
    quantity: partial.quantity,
    unit: partial.unit,
    category: partial.category,
    purchasedAt: partial.purchasedAt,
    expiresAt: partial.expiresAt,
    notes: partial.notes,
    source: partial.source,
    barcode: partial.barcode,
    updatedAt: partial.updatedAt ?? nowIso(),
  }
}

export function createShoppingItem(
  partial: Omit<ShoppingItem, 'id' | 'createdAt' | 'checked'> & {
    id?: string
    checked?: boolean
    createdAt?: string
  },
): ShoppingItem {
  return {
    id: partial.id ?? uid(),
    name: partial.name.trim(),
    quantity: partial.quantity,
    unit: partial.unit,
    checked: partial.checked ?? false,
    fromRecipe: partial.fromRecipe,
    createdAt: partial.createdAt ?? nowIso(),
  }
}

export function createWasteEvent(
  partial: Omit<WasteEvent, 'id' | 'at'> & { id?: string; at?: string },
): WasteEvent {
  return {
    id: partial.id ?? uid(),
    name: partial.name,
    category: partial.category,
    outcome: partial.outcome,
    quantity: partial.quantity,
    unit: partial.unit,
    wasExpired: partial.wasExpired,
    at: partial.at ?? nowIso(),
  }
}

function seedDemoItems(): PantryItem[] {
  const today = new Date()
  const iso = (offset: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }

  const demo: PantryItem[] = [
    createItem({
      name: 'Whole milk',
      quantity: 1,
      unit: 'carton',
      category: 'dairy',
      purchasedAt: iso(-2),
      expiresAt: iso(2),
      source: 'manual',
    }),
    createItem({
      name: 'Spinach',
      quantity: 1,
      unit: 'bag',
      category: 'produce',
      purchasedAt: iso(-1),
      expiresAt: iso(1),
      source: 'manual',
    }),
    createItem({
      name: 'Chicken breast',
      quantity: 2,
      unit: 'lbs',
      category: 'meat',
      purchasedAt: iso(0),
      expiresAt: iso(2),
      source: 'manual',
    }),
    createItem({
      name: 'Eggs',
      quantity: 12,
      unit: 'ct',
      category: 'dairy',
      purchasedAt: iso(-3),
      expiresAt: iso(14),
      source: 'manual',
    }),
    createItem({
      name: 'Rice',
      quantity: 1,
      unit: 'bag',
      category: 'pantry',
      purchasedAt: iso(-30),
      expiresAt: iso(300),
      source: 'manual',
    }),
    createItem({
      name: 'Tomatoes',
      quantity: 4,
      unit: 'ct',
      category: 'produce',
      purchasedAt: iso(-2),
      expiresAt: iso(-1),
      source: 'manual',
    }),
    createItem({
      name: 'Bread',
      quantity: 1,
      unit: 'loaf',
      category: 'bakery',
      purchasedAt: iso(-1),
      expiresAt: iso(3),
      source: 'manual',
    }),
    createItem({
      name: 'Cheddar cheese',
      quantity: 1,
      unit: 'block',
      category: 'dairy',
      purchasedAt: iso(-5),
      expiresAt: iso(10),
      source: 'manual',
    }),
  ]

  saveItems(demo)
  return demo
}

export interface SyncSnapshot {
  version: 1
  exportedAt: string
  items: PantryItem[]
  shopping: ShoppingItem[]
  waste: WasteEvent[]
  settings: AppSettings
}

export function exportSnapshot(
  items: PantryItem[],
  shopping: ShoppingItem[],
  waste: WasteEvent[],
  settings: AppSettings,
): SyncSnapshot {
  return {
    version: 1,
    exportedAt: nowIso(),
    items,
    shopping,
    waste,
    settings,
  }
}

export function applySnapshot(data: SyncSnapshot): void {
  saveItems(data.items.map(normalizeItem))
  saveShopping(data.shopping)
  saveWaste(data.waste)
  saveSettings({ ...DEFAULT_SETTINGS, ...data.settings })
}
