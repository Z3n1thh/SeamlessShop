import { useEffect, useState } from 'react'
import { usePantry } from '../hooks/usePantry'
import {
  CATEGORY_LABELS,
  daysUntilExpiry,
  getExpiryStatus,
  statusLabel,
} from '../lib/expiry'
import { InsightsView } from './InsightsView'
import { pullSnapshot, signInWithEmail, signOut } from '../lib/sync'
import type { SyncSnapshot } from '../lib/storage'
import {
  createHousehold,
  getMyHousehold,
  joinHousehold,
  leaveHousehold,
  pullHousehold,
  pushHousehold,
} from '../lib/household'

type MoreTab = 'alerts' | 'insights' | 'sync' | 'household'

export function MoreView() {
  const [tab, setTab] = useState<MoreTab>('alerts')

  return (
    <section className="view more-view">
      <div className="view-hero">
        <h1>More</h1>
        <p>Alerts, insights, sync, and household sharing.</p>
      </div>

      <div className="chip-row">
        {(
          [
            ['alerts', 'Alerts'],
            ['insights', 'Insights'],
            ['sync', 'Sync'],
            ['household', 'Household'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'alerts' ? <AlertsPanel /> : null}
      {tab === 'insights' ? <InsightsView /> : null}
      {tab === 'sync' ? <SyncPanel /> : null}
      {tab === 'household' ? <HouseholdPanel /> : null}
    </section>
  )
}

function AlertsPanel() {
  const { items, settings, setSettings, clearExpired, finishItem } = usePantry()

  const alerts = items.filter((item) => {
    const status = getExpiryStatus(item.expiresAt)
    return status === 'expired' || daysUntilExpiry(item.expiresAt) <= settings.alertDays
  })

  const expired = alerts.filter((i) => getExpiryStatus(i.expiresAt) === 'expired')
  const upcoming = alerts.filter((i) => getExpiryStatus(i.expiresAt) !== 'expired')

  return (
    <>
      <div className="settings-panel">
        <label className="toggle-row">
          <span>
            <strong>Browser notifications</strong>
            <small>Once a day when items are near expiry</small>
          </span>
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(e) => void setSettings({ notificationsEnabled: e.target.checked })}
          />
        </label>

        <label>
          Warn me this many days ahead
          <input
            type="range"
            min={1}
            max={7}
            value={settings.alertDays}
            onChange={(e) => void setSettings({ alertDays: Number(e.target.value) })}
          />
          <span className="range-value">{settings.alertDays} days</span>
        </label>

        {expired.length > 0 ? (
          <button type="button" className="btn ghost danger" onClick={() => clearExpired('thrown')}>
            Clear expired as thrown ({expired.length})
          </button>
        ) : null}
      </div>

      {!alerts.length ? (
        <div className="empty success">
          <p>All clear — nothing expiring in the next {settings.alertDays} days.</p>
        </div>
      ) : (
        <>
          {expired.length > 0 ? (
            <div className="alert-group">
              <h2>Expired</h2>
              <ul className="item-list">
                {expired.map((item) => {
                  const days = daysUntilExpiry(item.expiresAt)
                  return (
                    <li key={item.id} className="item-row status-expired">
                      <div className="item-main">
                        <div className="item-title-row">
                          <h3>{item.name}</h3>
                          <span className="pill status-expired">{statusLabel('expired', days)}</span>
                        </div>
                        <p className="item-meta">
                          {item.quantity} {item.unit} · {CATEGORY_LABELS[item.category]}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn ghost danger"
                        onClick={() => finishItem(item.id, 'thrown')}
                      >
                        Remove
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {upcoming.length > 0 ? (
            <div className="alert-group">
              <h2>Use soon</h2>
              <ul className="item-list">
                {upcoming.map((item) => {
                  const status = getExpiryStatus(item.expiresAt)
                  const days = daysUntilExpiry(item.expiresAt)
                  return (
                    <li key={item.id} className={`item-row status-${status}`}>
                      <div className="item-main">
                        <div className="item-title-row">
                          <h3>{item.name}</h3>
                          <span className={`pill status-${status}`}>{statusLabel(status, days)}</span>
                        </div>
                        <p className="item-meta">
                          {item.quantity} {item.unit} · {CATEGORY_LABELS[item.category]}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

function SyncPanel() {
  const {
    syncConfigured,
    syncEmail,
    settings,
    setSettings,
    exportData,
    importData,
    pushCloud,
    refreshSession,
  } = usePantry()
  const [email, setEmail] = useState(settings.syncEmail)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendMagicLink() {
    setBusy(true)
    setMessage(null)
    await setSettings({ syncEmail: email })
    const { error } = await signInWithEmail(email)
    setMessage(error ? error : 'Check your email for a magic link, then return here and pull/push.')
    setBusy(false)
    await refreshSession()
  }

  async function doPush() {
    setBusy(true)
    const { error } = await pushCloud()
    setMessage(error ?? 'Pushed kitchen data to the cloud.')
    setBusy(false)
  }

  async function doPull() {
    setBusy(true)
    const { snapshot, error } = await pullSnapshot()
    if (snapshot) {
      importData(snapshot)
      setMessage('Pulled latest kitchen data from the cloud.')
    } else {
      setMessage(error ?? 'Pull failed')
    }
    setBusy(false)
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seamlessshop-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as SyncSnapshot
        if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('bad')
        importData(data)
        setMessage('Backup imported.')
      } catch {
        setMessage('That file is not a valid SeamlessShop backup.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="settings-panel">
      <h2 className="section-title">Cross-device sync</h2>
      {syncConfigured ? (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Supabase is configured. Sign in with email on each device, then push/pull.
          </p>
          <p className="item-meta">Signed in as: {syncEmail ?? 'not signed in'}</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <div className="toolbar">
            <button type="button" className="btn primary" disabled={busy || !email} onClick={() => void sendMagicLink()}>
              Email magic link
            </button>
            {syncEmail ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => void signOut().then(refreshSession)}
              >
                Sign out
              </button>
            ) : null}
          </div>
          <div className="toolbar">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void doPush()}>
              Push to cloud
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void doPull()}>
              Pull from cloud
            </button>
          </div>
        </>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>
          Cloud sync needs free Supabase keys. Copy <code>.env.example</code> to <code>.env</code>, add
          your project URL + anon key, run <code>supabase/schema.sql</code>, then rebuild. Until then,
          use file backup below.
        </p>
      )}

      <h2 className="section-title">File backup</h2>
      <div className="toolbar">
        <button type="button" className="btn primary" onClick={downloadBackup}>
          Download backup
        </button>
        <label className="btn ghost file-btn">
          Import backup
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
        </label>
      </div>

      {message ? <p className="hint">{message}</p> : null}
    </div>
  )
}

function HouseholdPanel() {
  const { syncConfigured, syncEmail, settings, setSettings, exportData, importData, items, shopping, waste } =
    usePantry()
  const [name, setName] = useState('Our kitchen')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!syncConfigured || !syncEmail) return
    void getMyHousehold().then((h) => {
      if (h) {
        void setSettings({
          householdId: h.id,
          householdName: h.name,
          householdInvite: h.inviteCode,
        })
      }
    })
  }, [syncConfigured, syncEmail, setSettings])

  async function create() {
    setBusy(true)
    setMessage(null)
    const { household, error } = await createHousehold(name, exportData())
    if (household) {
      await setSettings({
        householdId: household.id,
        householdName: household.name,
        householdInvite: household.inviteCode,
      })
      setMessage(`Household created. Share invite code ${household.inviteCode}`)
    } else {
      setMessage(error ?? 'Could not create household')
    }
    setBusy(false)
  }

  async function join() {
    setBusy(true)
    setMessage(null)
    const { household, snapshot, error } = await joinHousehold(code)
    if (household) {
      await setSettings({
        householdId: household.id,
        householdName: household.name,
        householdInvite: household.inviteCode,
      })
      if (snapshot?.items) importData(snapshot)
      setMessage(`Joined ${household.name}`)
    } else {
      setMessage(error ?? 'Could not join')
    }
    setBusy(false)
  }

  async function pushShared() {
    if (!settings.householdId) return
    setBusy(true)
    const { error } = await pushHousehold(
      settings.householdId,
      items,
      shopping,
      waste,
      settings,
    )
    setMessage(error ?? 'Pushed shared household pantry.')
    setBusy(false)
  }

  async function pullShared() {
    if (!settings.householdId) return
    setBusy(true)
    const { snapshot, error } = await pullHousehold(settings.householdId)
    if (snapshot) {
      importData(snapshot)
      setMessage('Pulled shared household pantry.')
    } else {
      setMessage(error ?? 'Pull failed')
    }
    setBusy(false)
  }

  async function leave() {
    if (!settings.householdId) return
    setBusy(true)
    const { error } = await leaveHousehold(settings.householdId)
    if (!error) {
      await setSettings({ householdId: '', householdName: '', householdInvite: '' })
      setMessage('Left household.')
    } else {
      setMessage(error)
    }
    setBusy(false)
  }

  if (!syncConfigured) {
    return (
      <div className="settings-panel">
        <p className="hint" style={{ marginTop: 0 }}>
          Household sharing needs Supabase configured and signed-in sync.
        </p>
      </div>
    )
  }

  if (!syncEmail) {
    return (
      <div className="settings-panel">
        <p className="hint" style={{ marginTop: 0 }}>
          Sign in under the Sync tab first, then create or join a household.
        </p>
      </div>
    )
  }

  return (
    <div className="settings-panel">
      <h2 className="section-title">Shared household pantry</h2>
      {settings.householdId ? (
        <>
          <p className="item-meta">
            {settings.householdName} · invite <strong>{settings.householdInvite}</strong>
          </p>
          <div className="toolbar">
            <button type="button" className="btn primary" disabled={busy} onClick={() => void pushShared()}>
              Push shared
            </button>
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void pullShared()}>
              Pull shared
            </button>
            <button type="button" className="btn ghost danger" disabled={busy} onClick={() => void leave()}>
              Leave
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            Create household name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void create()}>
            Create household
          </button>
          <label>
            Or join with invite code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button type="button" className="btn ghost" disabled={busy || !code} onClick={() => void join()}>
            Join household
          </button>
        </>
      )}
      {message ? <p className="hint">{message}</p> : null}
    </div>
  )
}
