import { useEffect, useState } from 'react'
import type { Recipe } from '../types'
import { usePantry } from '../hooks/usePantry'
import { suggestRecipes } from '../lib/recipes'
import { MealPlanView } from './MealPlanView'

export function RecipesView() {
  const { items, addShopping } = usePantry()
  const [tab, setTab] = useState<'ideas' | 'plan'>('ideas')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function load() {
    if (!items.length) {
      setRecipes([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const next = await suggestRecipes(items)
      setRecipes(next)
      if (!next.length) setError('No strong matches yet — add more staples to your pantry.')
    } catch {
      setError('Could not load recipes. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addMissing(recipe: Recipe) {
    if (!recipe.missing.length) return
    addShopping(
      recipe.missing.map((name) => ({
        name,
        quantity: 1,
        unit: 'ea',
        fromRecipe: recipe.title,
      })),
    )
    setToast(
      `Added ${recipe.missing.length} missing ingredient${recipe.missing.length === 1 ? '' : 's'} to Shop`,
    )
    window.setTimeout(() => setToast(null), 2500)
  }

  return (
    <section className="view recipes-view">
      <div className="view-hero">
        <h1>Cook from what you have</h1>
        <p>Meal ideas and a week plan based on what’s already in your kitchen.</p>
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`chip ${tab === 'ideas' ? 'active' : ''}`}
          onClick={() => setTab('ideas')}
        >
          Ideas
        </button>
        <button
          type="button"
          className={`chip ${tab === 'plan' ? 'active' : ''}`}
          onClick={() => setTab('plan')}
        >
          Week plan
        </button>
      </div>

      {tab === 'plan' ? <MealPlanView /> : null}

      {tab === 'ideas' ? (
        <>
          <div className="toolbar">
            <button
              type="button"
              className="btn primary"
              disabled={loading || !items.length}
              onClick={() => void load()}
            >
              {loading ? 'Finding meals…' : 'Refresh suggestions'}
            </button>
          </div>

          {toast ? <p className="toast">{toast}</p> : null}

          {!items.length ? (
            <div className="empty">
              <p>Your pantry is empty. Add or scan groceries first.</p>
            </div>
          ) : null}

          {error && !recipes.length ? <p className="hint">{error}</p> : null}

          <ul className="recipe-list">
            {recipes.map((recipe) => {
              const open = openId === recipe.id
              const coverage = Math.round(
                (recipe.matched.length / Math.max(recipe.ingredients.length, 1)) * 100,
              )
              return (
                <li key={recipe.id} className="recipe-card">
                  {recipe.image ? (
                    <img src={recipe.image} alt="" className="recipe-image" loading="lazy" />
                  ) : (
                    <div className="recipe-image placeholder" aria-hidden="true">
                      ◈
                    </div>
                  )}
                  <div className="recipe-body">
                    <div className="recipe-title-row">
                      <h2>{recipe.title}</h2>
                      <span className="pill">{coverage}% match</span>
                    </div>
                    <p className="item-meta">
                      Have: {recipe.matched.slice(0, 4).join(', ') || '—'}
                      {recipe.missing.length
                        ? ` · Need: ${recipe.missing.slice(0, 3).join(', ')}`
                        : ' · You have everything'}
                    </p>
                    <div className="toolbar">
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => setOpenId(open ? null : recipe.id)}
                      >
                        {open ? 'Hide recipe' : 'Show recipe'}
                      </button>
                      {recipe.missing.length > 0 ? (
                        <button type="button" className="btn ghost" onClick={() => addMissing(recipe)}>
                          Add missing to Shop
                        </button>
                      ) : null}
                    </div>
                    {open ? (
                      <div className="recipe-details">
                        <h3>Ingredients</h3>
                        <ul>
                          {recipe.ingredients.map((ing) => (
                            <li key={ing} className={recipe.matched.includes(ing) ? 'have' : 'need'}>
                              {ing}
                            </li>
                          ))}
                        </ul>
                        <h3>Steps</h3>
                        <p className="instructions">{recipe.instructions}</p>
                        {recipe.sourceUrl ? (
                          <a
                            href={recipe.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link"
                          >
                            Source
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="hint">
            Recipes from TheMealDB (free) when online, plus local ideas when you’re offline. No paid API
            keys.
          </p>
        </>
      ) : null}
    </section>
  )
}
