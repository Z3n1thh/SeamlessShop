import type { PantryItem, Recipe } from '../types'

interface MealDbMeal {
  idMeal: string
  strMeal: string
  strMealThumb: string
  strInstructions: string
  strSource?: string
  strYoutube?: string
  [key: string]: string | undefined
}

interface MealDbList {
  meals: MealDbMeal[] | null
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'with', 'fresh', 'organic', 'whole', 'raw', 'large', 'small', 'extra',
])

const cache = new Map<string, { at: number; recipes: Recipe[] }>()
const CACHE_MS = 5 * 60 * 1000
const detailCache = new Map<string, MealDbMeal>()

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
}

function mealIngredients(meal: MealDbMeal): string[] {
  const list: string[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`]?.trim()
    if (ing) list.push(ing)
  }
  return list
}

function matchScore(pantryTokens: string[], ingredient: string): boolean {
  const ingTokens = tokens(ingredient)
  if (!ingTokens.length) return false
  return ingTokens.some((t) => pantryTokens.some((p) => p.includes(t) || t.includes(p)))
}

const LOCAL_RECIPES: Omit<Recipe, 'matched' | 'missing'>[] = [
  {
    id: 'local-1',
    title: 'Spinach Omelette',
    image: '',
    ingredients: ['eggs', 'spinach', 'cheese', 'butter', 'milk'],
    instructions:
      'Beat eggs with a splash of milk. Wilt spinach in butter, pour eggs, add cheese, fold, and serve.',
  },
  {
    id: 'local-2',
    title: 'Tomato Rice Bowl',
    image: '',
    ingredients: ['rice', 'tomato', 'onion', 'garlic', 'oil'],
    instructions:
      'Cook rice. Sauté onion and garlic in oil, add chopped tomatoes, simmer, and spoon over rice.',
  },
  {
    id: 'local-3',
    title: 'Cheesy Chicken Skillet',
    image: '',
    ingredients: ['chicken', 'cheese', 'tomato', 'onion', 'garlic'],
    instructions:
      'Sear chicken with onion and garlic. Add tomatoes, simmer until tender, top with cheese to melt.',
  },
  {
    id: 'local-4',
    title: 'Avocado Toast Upgrade',
    image: '',
    ingredients: ['bread', 'egg', 'avocado', 'tomato'],
    instructions: 'Toast bread, mash avocado on top, add sliced tomato and a fried or poached egg.',
  },
  {
    id: 'local-5',
    title: 'Simple Pasta Night',
    image: '',
    ingredients: ['pasta', 'garlic', 'oil', 'cheese', 'tomato'],
    instructions: 'Boil pasta. Warm garlic in oil, toss with pasta, tomatoes, and grated cheese.',
  },
]

function scoreRecipe(
  pantry: PantryItem[],
  ingredients: string[],
): { matched: string[]; missing: string[]; score: number } {
  const pantryTokens = pantry.flatMap((p) => tokens(p.name))
  const matched: string[] = []
  const missing: string[] = []

  for (const ing of ingredients) {
    if (matchScore(pantryTokens, ing)) matched.push(ing)
    else missing.push(ing)
  }

  const score = ingredients.length ? matched.length / ingredients.length : 0
  return { matched, missing, score }
}

function cacheKey(pantry: PantryItem[]): string {
  return pantry
    .map((p) => p.name.toLowerCase())
    .sort()
    .join('|')
}

async function fetchMealDetail(id: string): Promise<MealDbMeal | null> {
  const cached = detailCache.get(id)
  if (cached) return cached
  const detailRes = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`)
  if (!detailRes.ok) return null
  const detail = (await detailRes.json()) as MealDbList
  const meal = detail.meals?.[0]
  if (meal) detailCache.set(id, meal)
  return meal ?? null
}

export async function suggestRecipes(pantry: PantryItem[]): Promise<Recipe[]> {
  if (!pantry.length) return []

  const key = cacheKey(pantry)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.recipes

  const primary = [...new Set(pantry.map((p) => tokens(p.name)[0]).filter(Boolean))].slice(0, 3)
  const collected = new Map<string, Recipe>()

  try {
    // Fewer parallel filter calls → snappier Cook tab
    const filterResults = await Promise.all(
      primary.map(async (term) => {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(term)}`,
        )
        if (!res.ok) return [] as MealDbMeal[]
        const data = (await res.json()) as MealDbList
        return data.meals?.slice(0, 3) ?? []
      }),
    )

    const uniqueIds = [...new Set(filterResults.flat().map((m) => m.idMeal))].slice(0, 8)

    await Promise.all(
      uniqueIds.map(async (id) => {
        const meal = await fetchMealDetail(id)
        if (!meal) return
        const ingredients = mealIngredients(meal)
        const { matched, missing, score } = scoreRecipe(pantry, ingredients)
        if (score < 0.25 && matched.length < 2) return
        collected.set(meal.idMeal, {
          id: meal.idMeal,
          title: meal.strMeal,
          image: meal.strMealThumb,
          ingredients,
          matched,
          missing,
          instructions: meal.strInstructions ?? '',
          sourceUrl: meal.strSource || meal.strYoutube || undefined,
        })
      }),
    )
  } catch {
    // fall through to local recipes
  }

  if (collected.size === 0) {
    for (const r of LOCAL_RECIPES) {
      const { matched, missing, score } = scoreRecipe(pantry, r.ingredients)
      if (score >= 0.3 || matched.length >= 2) {
        collected.set(r.id, { ...r, matched, missing })
      }
    }
  }

  const recipes = [...collected.values()]
    .map((r) => ({ recipe: r, score: scoreRecipe(pantry, r.ingredients).score }))
    .sort((a, b) => b.score - a.score || b.recipe.matched.length - a.recipe.matched.length)
    .slice(0, 10)
    .map((x) => x.recipe)

  cache.set(key, { at: Date.now(), recipes })
  return recipes
}
