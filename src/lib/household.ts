import type { SyncSnapshot } from './storage'
import { exportSnapshot, type AppSettings } from './storage'
import type { PantryItem, ShoppingItem, WasteEvent } from '../types'
import { getSupabase, isSyncConfigured } from './sync'

function inviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)]
  return code
}

export interface HouseholdInfo {
  id: string
  name: string
  inviteCode: string
}

export async function getMyHousehold(): Promise<HouseholdInfo | null> {
  const sb = getSupabase()
  if (!sb || !isSyncConfigured()) return null
  const { data: session } = await sb.auth.getSession()
  const user = session.session?.user
  if (!user) return null

  const { data: membership } = await sb
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return null

  const { data: house } = await sb
    .from('households')
    .select('id, name, invite_code')
    .eq('id', membership.household_id)
    .maybeSingle()

  if (!house) return null
  return { id: house.id, name: house.name, inviteCode: house.invite_code }
}

export async function createHousehold(
  name: string,
  snapshot: SyncSnapshot,
): Promise<{ household?: HouseholdInfo; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data: session } = await sb.auth.getSession()
  const user = session.session?.user
  if (!user) return { error: 'Sign in first' }

  const id = crypto.randomUUID()
  const code = inviteCode()
  const { error } = await sb.from('households').insert({
    id,
    name: name.trim() || 'Our kitchen',
    invite_code: code,
    payload: snapshot,
    updated_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }

  const { error: memErr } = await sb.from('household_members').insert({
    household_id: id,
    user_id: user.id,
    role: 'owner',
  })
  if (memErr) return { error: memErr.message }

  return {
    household: { id, name: name.trim() || 'Our kitchen', inviteCode: code },
  }
}

export async function joinHousehold(
  code: string,
): Promise<{ household?: HouseholdInfo; snapshot?: SyncSnapshot; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data: session } = await sb.auth.getSession()
  if (!session.session?.user) return { error: 'Sign in first' }

  const { data, error } = await sb.rpc('join_household', {
    p_code: code.trim().toUpperCase(),
  })

  if (error) return { error: error.message }
  const row = data as {
    id: string
    name: string
    invite_code: string
    payload: SyncSnapshot
  }
  return {
    household: { id: row.id, name: row.name, inviteCode: row.invite_code },
    snapshot: row.payload,
  }
}

export async function pushHousehold(
  householdId: string,
  items: PantryItem[],
  shopping: ShoppingItem[],
  waste: WasteEvent[],
  settings: AppSettings,
): Promise<{ error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const snapshot = exportSnapshot(items, shopping, waste, settings)
  const { error } = await sb
    .from('households')
    .update({ payload: snapshot, updated_at: new Date().toISOString() })
    .eq('id', householdId)
  return error ? { error: error.message } : {}
}

export async function pullHousehold(
  householdId: string,
): Promise<{ snapshot?: SyncSnapshot; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data, error } = await sb
    .from('households')
    .select('payload')
    .eq('id', householdId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data?.payload) return { error: 'Household has no shared data yet' }
  return { snapshot: data.payload as SyncSnapshot }
}

export async function leaveHousehold(householdId: string): Promise<{ error?: string }> {
  const sb = getSupabase()
  if (!sb) return { error: 'Sync not configured' }
  const { data: session } = await sb.auth.getSession()
  const user = session.session?.user
  if (!user) return { error: 'Sign in first' }
  const { error } = await sb
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', user.id)
  return error ? { error: error.message } : {}
}
