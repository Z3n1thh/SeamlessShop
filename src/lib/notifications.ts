import type { PantryItem } from '../types'
import { daysUntilExpiry, getExpiryStatus } from './expiry'
import type { AppSettings } from './storage'

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function notifyExpiring(items: PantryItem[], settings: AppSettings): void {
  if (!settings.notificationsEnabled) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const soon = items.filter((item) => {
    const status = getExpiryStatus(item.expiresAt)
    const days = daysUntilExpiry(item.expiresAt)
    return status === 'expired' || days <= settings.alertDays
  })

  if (!soon.length) return

  const lastKey = 'seamlessshop-last-notify'
  const today = new Date().toISOString().slice(0, 10)
  if (localStorage.getItem(lastKey) === today) return
  localStorage.setItem(lastKey, today)

  const expired = soon.filter((i) => getExpiryStatus(i.expiresAt) === 'expired')
  const upcoming = soon.filter((i) => getExpiryStatus(i.expiresAt) !== 'expired')

  let body = ''
  if (expired.length) body += `${expired.length} item${expired.length > 1 ? 's' : ''} expired. `
  if (upcoming.length)
    body += `${upcoming.length} item${upcoming.length > 1 ? 's' : ''} expiring within ${settings.alertDays} days.`

  new Notification('SeamlessShop pantry alert', {
    body: body.trim(),
    icon: '/favicon.svg',
    tag: 'pantry-expiry',
  })
}
