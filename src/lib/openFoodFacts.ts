import type { FoodCategory, ScannedItem } from '../types'
import { estimateExpiry, guessCategory } from './expiry'

export interface ProductLookup {
  barcode: string
  name: string
  brand?: string
  quantity?: string
  image?: string
  category: FoodCategory
  expiresAt: string
}

/** Free Open Food Facts API — no key required. */
export async function lookupBarcode(barcode: string): Promise<ProductLookup | null> {
  const code = barcode.replace(/\D/g, '')
  if (code.length < 8) return null

  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`)
  if (!res.ok) return null
  const data = (await res.json()) as {
    status: number
    product?: {
      product_name?: string
      product_name_en?: string
      brands?: string
      quantity?: string
      image_front_small_url?: string
      categories_tags?: string[]
    }
  }
  if (data.status !== 1 || !data.product) return null

  const name =
    data.product.product_name_en ||
    data.product.product_name ||
    data.product.brands ||
    `Product ${code}`

  const category = categoryFromOff(data.product.categories_tags) || guessCategory(name)

  return {
    barcode: code,
    name: titleCase(name),
    brand: data.product.brands,
    quantity: data.product.quantity,
    image: data.product.image_front_small_url,
    category,
    expiresAt: estimateExpiry(name).toISOString().slice(0, 10),
  }
}

export function productToScanned(product: ProductLookup): ScannedItem {
  return {
    name: product.brand ? `${product.name}` : product.name,
    quantity: 1,
    unit: 'ea',
    category: product.category,
    expiresAt: product.expiresAt,
    selected: true,
    barcode: product.barcode,
    source: 'barcode',
  }
}

function categoryFromOff(tags?: string[]): FoodCategory | null {
  if (!tags?.length) return null
  const joined = tags.join(' ').toLowerCase()
  if (/dairy|milk|cheese|yogurt|butter|egg/.test(joined)) return 'dairy'
  if (/meat|chicken|beef|pork|poultry/.test(joined)) return 'meat'
  if (/seafood|fish|shrimp/.test(joined)) return 'seafood'
  if (/bread|bakery|pastry/.test(joined)) return 'bakery'
  if (/frozen/.test(joined)) return 'frozen'
  if (/beverage|drink|juice|soda|water/.test(joined)) return 'beverage'
  if (/fruit|vegetable|produce|fresh/.test(joined)) return 'produce'
  if (/grocery|pantry|pasta|rice|cereal|sauce|oil|spice/.test(joined)) return 'pantry'
  return null
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}
