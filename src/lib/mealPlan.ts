import { addDays, format, parseISO } from 'date-fns'
import type { PantryItem, Recipe } from '../types'
import { daysUntilExpiry, getExpiryStatus } from './expiry'
import { suggestRecipes } from './recipes'

export interface MealPlanDay {
  date: string
  label: string
  focusItems: string[]
  recipe: Recipe | null
}

/** Build a 7-day plan prioritizing items that expire soon. */
export async function buildWeekMealPlan(pantry: PantryItem[]): Promise<MealPlanDay[]> {
  const urgently = pantry
    .filter((i) => {
      const s = getExpiryStatus(i.expiresAt)
      return s === 'urgent' || s === 'soon' || s === 'expired' || daysUntilExpiry(i.expiresAt) <= 5
    })
    .sort((a, b) => daysUntilExpiry(a.expiresAt) - daysUntilExpiry(b.expiresAt))

  const recipes = await suggestRecipes(pantry.length ? pantry : urgently)
  const usedRecipeIds = new Set<string>()
  const days: MealPlanDay[] = []

  for (let i = 0; i < 7; i++) {
    const date = addDays(new Date(), i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : format(date, 'EEE MMM d')

    // Prefer recipes that use the next expiring unused item
    const focus = urgently.slice(i, i + 2).map((x) => x.name)
    let recipe =
      recipes.find(
        (r) =>
          !usedRecipeIds.has(r.id) &&
          focus.some((f) =>
            r.matched.some((m) => m.toLowerCase().includes(f.toLowerCase().split(' ')[0])),
          ),
      ) ?? recipes.find((r) => !usedRecipeIds.has(r.id)) ?? null

    if (recipe) usedRecipeIds.add(recipe.id)

    days.push({
      date: dateStr,
      label,
      focusItems: focus,
      recipe,
    })
  }

  // If we ran out of unique recipes, still show days with focus items
  return days
}

export function mealPlanShoppingGaps(plan: MealPlanDay[]): string[] {
  const missing = new Set<string>()
  for (const day of plan) {
    for (const m of day.recipe?.missing ?? []) missing.add(m)
  }
  return [...missing]
}

export function expiringThisWeek(pantry: PantryItem[]): PantryItem[] {
  return pantry
    .filter((i) => daysUntilExpiry(i.expiresAt) <= 7)
    .sort((a, b) => parseISO(a.expiresAt).getTime() - parseISO(b.expiresAt).getTime())
}
