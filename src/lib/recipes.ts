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
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'with',
  'fresh',
  'organic',
  'whole',
  'raw',
  'large',
  'small',
  'extra',
])

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

/** Local fallback recipes when offline / API unavailable. */
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
    instructions:
      'Boil pasta. Warm garlic in oil, toss with pasta, tomatoes, and grated cheese.',
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

export async function suggestRecipes(pantry: PantryItem[]): Promise<Recipe[]> {
  if (!pantry.length) return []

  const primary = pantry
    .map((p) => tokens(p.name)[0])
    .filter(Boolean)
    .slice(0, 6)

  const collected = new Map<string, Recipe>()

  try {
    await Promise.all(
      primary.map(async (term) => {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(term)}`,
        )
        if (!res.ok) return
        const data = (await res.json()) as MealDbList
        const meals = data.meals?.slice(0, 4) ?? []
        await Promise.all(
          meals.map(async (m) => {
            if (collected.has(m.idMeal)) return
            const detailRes = await fetch(
              `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`,
            )
            if (!detailRes.ok) return
            const detail = (await detailRes.json()) as MealDbList
            const meal = detail.meals?.[0]
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

  return [...collected.values()]
    .map((r) => {
      const { score } = scoreRecipe(pantry, r.ingredients)
      return { recipe: r, score }
    })
    .sort((a, b) => b.score - a.score || b.recipe.matched.length - a.recipe.matched.length)
    .slice(0, 12)
    .map((x) => x.recipe)
}
