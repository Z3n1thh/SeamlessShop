import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PantryItem, ShoppingItem, WasteEvent, WasteOutcome } from '../types'
import {
  createItem,
  createShoppingItem,
  createWasteEvent,
  loadItems,
  loadSettings,
  loadShopping,
  loadWaste,
  saveItems,
  saveSettings,
  saveShopping,
  saveWaste,
  applySnapshot,
  exportSnapshot,
  nowIso,
  type AppSettings,
  type SyncSnapshot,
} from '../lib/storage'
import { notifyExpiring, requestNotificationPermission } from '../lib/notifications'
import { daysUntilExpiry, estimateExpiry, getExpiryStatus, guessCategory, sortByExpiry } from '../lib/expiry'
import { findPantryMatch } from '../lib/groceryMatch'
import { getSessionEmail, isSyncConfigured, syncPush } from '../lib/sync'

interface PantryContextValue {
  items: PantryItem[]
  shopping: ShoppingItem[]
  waste: WasteEvent[]
  settings: AppSettings
  syncConfigured: boolean
  syncEmail: string | null
  shopCount: number
  expiringCount: number
  addItems: (items: Omit<PantryItem, 'id' | 'updatedAt'>[]) => void
  /** Add groceries; bump qty when the same item is already in the pantry. */
  addOrMergeItems: (items: Omit<PantryItem, 'id' | 'updatedAt'>[]) => { added: number; merged: number }
  updateItem: (id: string, patch: Partial<PantryItem>) => void
  finishItem: (id: string, outcome: WasteOutcome, restock?: boolean) => void
  clearExpired: (outcome: WasteOutcome) => void
  addShopping: (items: { name: string; quantity?: number; unit?: string; fromRecipe?: string }[]) => void
  toggleShopping: (id: string) => void
  removeShopping: (id: string) => void
  clearCheckedShopping: () => void
  buyShoppingToPantry: () => void
  markShoppingBought: (names: string[]) => void
  setSettings: (patch: Partial<AppSettings>) => Promise<void>
  exportData: () => SyncSnapshot
  importData: (snapshot: SyncSnapshot) => void
  pushCloud: () => Promise<{ error?: string }>
  refreshSession: () => Promise<void>
}

const PantryContext = createContext<PantryContextValue | null>(null)

export function PantryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PantryItem[]>(() => loadItems())
  const [shopping, setShopping] = useState<ShoppingItem[]>(() => loadShopping())
  const [waste, setWaste] = useState<WasteEvent[]>(() => loadWaste())
  const [settings, setSettingsState] = useState<AppSettings>(() => loadSettings())
  const [syncEmail, setSyncEmail] = useState<string | null>(null)

  useEffect(() => {
    saveItems(items)
  }, [items])

  useEffect(() => {
    saveShopping(shopping)
  }, [shopping])

  useEffect(() => {
    saveWaste(waste)
  }, [waste])

  useEffect(() => {
    notifyExpiring(items, settings)
  }, [items, settings])

  const refreshSession = useCallback(async () => {
    if (!isSyncConfigured()) {
      setSyncEmail(null)
      return
    }
    setSyncEmail(await getSessionEmail())
  }, [])

  useEffect(() => {
    // Don't block first paint — refresh auth after idle
    const t = window.setTimeout(() => {
      void refreshSession()
    }, 0)
    return () => window.clearTimeout(t)
  }, [refreshSession])

  const addItems = useCallback((incoming: Omit<PantryItem, 'id' | 'updatedAt'>[]) => {
    setItems((prev) => [...incoming.map((i) => createItem(i)), ...prev])
  }, [])

  const addOrMergeItems = useCallback((incoming: Omit<PantryItem, 'id' | 'updatedAt'>[]) => {
    let added = 0
    let merged = 0
    setItems((prev) => {
      const next = [...prev]
      const indexByName = new Map(next.map((item, i) => [item.name.toLowerCase(), i]))
      for (const raw of incoming) {
        const names = next.map((i) => i.name)
        const matchName = findPantryMatch(raw.name, names)
        if (matchName) {
          const idx =
            indexByName.get(matchName.toLowerCase()) ??
            next.findIndex((i) => i.name === matchName)
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              quantity: next[idx].quantity + raw.quantity,
              expiresAt: raw.expiresAt || next[idx].expiresAt,
              purchasedAt: raw.purchasedAt || next[idx].purchasedAt,
              updatedAt: nowIso(),
              source: raw.source ?? next[idx].source,
              barcode: raw.barcode ?? next[idx].barcode,
            }
            merged++
            continue
          }
        }
        const created = createItem(raw)
        next.unshift(created)
        // shift indexes after unshift
        for (const [k, v] of indexByName) indexByName.set(k, v + 1)
        indexByName.set(created.name.toLowerCase(), 0)
        added++
      }
      return next
    })
    return { added, merged }
  }, [])

  const markShoppingBought = useCallback((names: string[]) => {
    setShopping((prev) =>
      prev.map((item) => {
        const hit = findPantryMatch(
          item.name,
          names,
        )
        return hit ? { ...item, checked: true } : item
      }),
    )
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<PantryItem>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item,
      ),
    )
  }, [])

  const finishItem = useCallback((id: string, outcome: WasteOutcome, restock = false) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (!item) return prev
      setWaste((w) => [
        createWasteEvent({
          name: item.name,
          category: item.category,
          outcome,
          quantity: item.quantity,
          unit: item.unit,
          wasExpired: getExpiryStatus(item.expiresAt) === 'expired',
        }),
        ...w,
      ])
      if (restock) {
        setShopping((s) => [
          createShoppingItem({ name: item.name, quantity: item.quantity, unit: item.unit }),
          ...s,
        ])
      }
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const clearExpired = useCallback((outcome: WasteOutcome) => {
    setItems((prev) => {
      const expired = prev.filter((item) => getExpiryStatus(item.expiresAt) === 'expired')
      if (!expired.length) return prev
      setWaste((w) => [
        ...expired.map((item) =>
          createWasteEvent({
            name: item.name,
            category: item.category,
            outcome,
            quantity: item.quantity,
            unit: item.unit,
            wasExpired: true,
          }),
        ),
        ...w,
      ])
      return prev.filter((item) => getExpiryStatus(item.expiresAt) !== 'expired')
    })
  }, [])

  const addShopping = useCallback(
    (incoming: { name: string; quantity?: number; unit?: string; fromRecipe?: string }[]) => {
      setShopping((prev) => {
        const next = [...prev]
        for (const item of incoming) {
          const name = item.name.trim()
          if (!name) continue
          const existing = next.find(
            (s) => !s.checked && s.name.toLowerCase() === name.toLowerCase(),
          )
          if (existing) {
            existing.quantity += item.quantity ?? 1
          } else {
            next.unshift(
              createShoppingItem({
                name,
                quantity: item.quantity ?? 1,
                unit: item.unit ?? 'ea',
                fromRecipe: item.fromRecipe,
              }),
            )
          }
        }
        return [...next]
      })
    },
    [],
  )

  const toggleShopping = useCallback((id: string) => {
    setShopping((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    )
  }, [])

  const removeShopping = useCallback((id: string) => {
    setShopping((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearCheckedShopping = useCallback(() => {
    setShopping((prev) => prev.filter((item) => !item.checked))
  }, [])

  const buyShoppingToPantry = useCallback(() => {
    setShopping((prev) => {
      const checked = prev.filter((i) => i.checked)
      if (checked.length) {
        const today = new Date().toISOString().slice(0, 10)
        setItems((items) => [
          ...checked.map((s) =>
            createItem({
              name: s.name,
              quantity: s.quantity,
              unit: s.unit,
              category: guessCategory(s.name),
              purchasedAt: today,
              expiresAt: estimateExpiry(s.name).toISOString().slice(0, 10),
              source: 'manual',
            }),
          ),
          ...items,
        ])
      }
      return prev.filter((i) => !i.checked)
    })
  }, [])

  const setSettings = useCallback(async (patch: Partial<AppSettings>) => {
    let next = { ...loadSettings(), ...patch }
    if (patch.notificationsEnabled) {
      const ok = await requestNotificationPermission()
      next = { ...next, notificationsEnabled: ok }
    }
    saveSettings(next)
    setSettingsState(next)
  }, [])

  const exportData = useCallback(
    () => exportSnapshot(items, shopping, waste, settings),
    [items, shopping, waste, settings],
  )

  const importData = useCallback((snapshot: SyncSnapshot) => {
    applySnapshot(snapshot)
    setItems(loadItems())
    setShopping(loadShopping())
    setWaste(loadWaste())
    setSettingsState(loadSettings())
  }, [])

  const pushCloud = useCallback(async () => {
    return syncPush(items, shopping, waste, settings)
  }, [items, shopping, waste, settings])

  const expiringCount = useMemo(
    () =>
      items.filter((item) => {
        const status = getExpiryStatus(item.expiresAt)
        return status === 'expired' || daysUntilExpiry(item.expiresAt) <= settings.alertDays
      }).length,
    [items, settings.alertDays],
  )

  const shopCount = useMemo(
    () => shopping.filter((s) => !s.checked).length,
    [shopping],
  )

  const value = useMemo(
    () => ({
      items: sortByExpiry(items),
      shopping,
      waste,
      settings,
      syncConfigured: isSyncConfigured(),
      syncEmail,
      shopCount,
      expiringCount,
      addItems,
      addOrMergeItems,
      updateItem,
      finishItem,
      clearExpired,
      addShopping,
      toggleShopping,
      removeShopping,
      clearCheckedShopping,
      buyShoppingToPantry,
      markShoppingBought,
      setSettings,
      exportData,
      importData,
      pushCloud,
      refreshSession,
    }),
    [
      items,
      shopping,
      waste,
      settings,
      syncEmail,
      shopCount,
      expiringCount,
      addItems,
      addOrMergeItems,
      updateItem,
      finishItem,
      clearExpired,
      addShopping,
      toggleShopping,
      removeShopping,
      clearCheckedShopping,
      buyShoppingToPantry,
      markShoppingBought,
      setSettings,
      exportData,
      importData,
      pushCloud,
      refreshSession,
    ],
  )

  return <PantryContext.Provider value={value}>{children}</PantryContext.Provider>
}

export function usePantry() {
  const ctx = useContext(PantryContext)
  if (!ctx) throw new Error('usePantry must be used within PantryProvider')
  return ctx
}
