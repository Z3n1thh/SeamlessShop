import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { PantryItem, ShoppingItem, WasteEvent } from '../types'
import type { AppSettings, SyncSnapshot } from './storage'
import { exportSnapshot } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export function isSyncConfigured(): boolean {
  return Boolean(url && anon)
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured()) return null
  if (!client) client = createClient(url!, anon!)
  return client
}

export async function signInWithEmail(email: string): Promise<{ error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync is not configured. Add Supabase env vars.' }
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut()
}

export async function getSessionEmail(): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.user.email ?? null
}

export async function pushSnapshot(snapshot: SyncSnapshot): Promise<{ error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data: sessionData } = await sb.auth.getSession()
  const user = sessionData.session?.user
  if (!user) return { error: 'Sign in to sync across devices' }

  const { error } = await sb.from('kitchen_state').upsert(
    {
      user_id: user.id,
      payload: snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  return error ? { error: error.message } : {}
}

export async function pullSnapshot(): Promise<{ snapshot?: SyncSnapshot; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data: sessionData } = await sb.auth.getSession()
  const user = sessionData.session?.user
  if (!user) return { error: 'Sign in to sync across devices' }

  const { data, error } = await sb
    .from('kitchen_state')
    .select('payload')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data?.payload) return { error: 'No cloud data yet — push from this device first.' }
  return { snapshot: data.payload as SyncSnapshot }
}

export async function syncPush(
  items: PantryItem[],
  shopping: ShoppingItem[],
  waste: WasteEvent[],
  settings: AppSettings,
): Promise<{ error?: string }> {
  return pushSnapshot(exportSnapshot(items, shopping, waste, settings))
}
