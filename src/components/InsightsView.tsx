import { useMemo } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { usePantry } from '../hooks/usePantry'

export function InsightsView() {
  const { waste } = usePantry()

  const stats = useMemo(() => {
    const cutoff = subDays(new Date(), 30)
    const recent = waste.filter((e) => parseISO(e.at) >= cutoff)
    const used = recent.filter((e) => e.outcome === 'used')
    const thrown = recent.filter((e) => e.outcome === 'thrown')
    const expiredThrown = thrown.filter((e) => e.wasExpired)
    const total = used.length + thrown.length
    const savedRate = total ? Math.round((used.length / total) * 100) : 100

    const byCategory = new Map<string, number>()
    for (const e of thrown) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1)
    }
    const topWaste = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { used, thrown, expiredThrown, savedRate, topWaste, recent }
  }, [waste])

  return (
    <section className="insights-block">
      <div className="view-hero">
        <h2>Waste insights</h2>
        <p>Last 30 days — used vs thrown away.</p>
      </div>

      <div className="stat-row">
        <div>
          <strong>{stats.used.length}</strong>
          <span>used</span>
        </div>
        <div>
          <strong>{stats.thrown.length}</strong>
          <span>thrown</span>
        </div>
        <div>
          <strong>{stats.savedRate}%</strong>
          <span>used rate</span>
        </div>
      </div>

      {stats.expiredThrown.length > 0 ? (
        <p className="hint">
          {stats.expiredThrown.length} thrown item{stats.expiredThrown.length === 1 ? '' : 's'} had already
          expired — tighten alerts or cook those first.
        </p>
      ) : null}

      {stats.topWaste.length > 0 ? (
        <div className="insight-bars">
          <h3>Most wasted categories</h3>
          {stats.topWaste.map(([cat, count]) => (
            <div key={cat} className="bar-row">
              <span>{cat}</span>
              <div className="bar-track">
                <div
                  className="bar-fill waste"
                  style={{ width: `${(count / (stats.topWaste[0][1] || 1)) * 100}%` }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty success">
          <p>No waste logged yet. When you finish an item, choose Used or Threw away.</p>
        </div>
      )}

      {stats.recent.length > 0 ? (
        <ul className="item-list" style={{ marginTop: '1rem' }}>
          {stats.recent.slice(0, 12).map((e) => (
            <li key={e.id} className={`item-row status-${e.outcome === 'thrown' ? 'expired' : 'fresh'}`}>
              <div className="item-main">
                <div className="item-title-row">
                  <h3>{e.name}</h3>
                  <span className={`pill status-${e.outcome === 'thrown' ? 'expired' : 'fresh'}`}>
                    {e.outcome === 'used' ? 'Used' : 'Thrown'}
                  </span>
                </div>
                <p className="item-meta">
                  {format(parseISO(e.at), 'MMM d')} · {e.quantity} {e.unit}
                  {e.wasExpired ? ' · was expired' : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
