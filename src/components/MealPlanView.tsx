import { useEffect, useState } from 'react'
import { usePantry } from '../hooks/usePantry'
import { buildWeekMealPlan, expiringThisWeek, mealPlanShoppingGaps, type MealPlanDay } from '../lib/mealPlan'

export function MealPlanView() {
  const { items, addShopping } = usePantry()
  const [plan, setPlan] = useState<MealPlanDay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const expiring = expiringThisWeek(items)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setPlan(await buildWeekMealPlan(items))
    } catch {
      setError('Could not build a meal plan right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addGaps() {
    const gaps = mealPlanShoppingGaps(plan)
    if (!gaps.length) return
    addShopping(gaps.map((name) => ({ name, fromRecipe: 'Meal plan' })))
  }

  return (
    <section className="meal-plan-block">
      <div className="view-hero">
        <h2>Week meal plan</h2>
        <p>Built around what’s expiring in the next 7 days.</p>
      </div>

      {expiring.length > 0 ? (
        <p className="hint" style={{ marginTop: 0 }}>
          Priority ingredients: {expiring.slice(0, 5).map((i) => i.name).join(', ')}
        </p>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>Nothing urgent expiring — suggesting meals from your full pantry.</p>
      )}

      <div className="toolbar">
        <button type="button" className="btn primary" disabled={loading || !items.length} onClick={() => void load()}>
          {loading ? 'Planning…' : 'Refresh plan'}
        </button>
        <button type="button" className="btn ghost" disabled={!plan.length} onClick={addGaps}>
          Add plan gaps to Shop
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <ul className="item-list">
        {plan.map((day) => (
          <li key={day.date} className="item-row meal-day">
            <div className="item-main">
              <div className="item-title-row">
                <h3>{day.label}</h3>
                {day.focusItems.length ? (
                  <span className="pill status-soon">Use: {day.focusItems[0]}</span>
                ) : null}
              </div>
              {day.recipe ? (
                <>
                  <p className="item-meta">
                    <strong>{day.recipe.title}</strong>
                    {day.recipe.missing.length
                      ? ` · need ${day.recipe.missing.slice(0, 2).join(', ')}`
                      : ' · pantry covered'}
                  </p>
                </>
              ) : (
                <p className="item-meta">No recipe match — cook something simple with leftovers.</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
