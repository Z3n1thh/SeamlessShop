import { useMemo, useState } from 'react'
import type { FoodCategory, PantryItem, WasteOutcome } from '../types'
import { usePantry } from '../hooks/usePantry'
import {
  CATEGORY_LABELS,
  daysUntilExpiry,
  estimateExpiry,
  getExpiryStatus,
  guessCategory,
  statusLabel,
} from '../lib/expiry'

const UNITS = ['ea', 'ct', 'lbs', 'oz', 'bag', 'carton', 'loaf', 'block', 'bottle']
const CATEGORIES = Object.keys(CATEGORY_LABELS) as FoodCategory[]

export function PantryView() {
  const { items, addItems, updateItem, finishItem } = usePantry()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<FoodCategory | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PantryItem | null>(null)
  const [finishing, setFinishing] = useState<PantryItem | null>(null)

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || item.name.toLowerCase().includes(q)
      const matchesCat = category === 'all' || item.category === category
      return matchesQuery && matchesCat
    })
  }, [items, query, category])

  const fresh = filtered.filter((i) => getExpiryStatus(i.expiresAt) === 'fresh').length
  const watch = filtered.length - fresh

  return (
    <section className="view pantry-view">
      <div className="view-hero">
        <h1>Your pantry</h1>
        <p>Track what you bought before it spoils.</p>
      </div>

      <div className="stat-row" aria-label="Pantry summary">
        <div>
          <strong>{items.length}</strong>
          <span>items</span>
        </div>
        <div>
          <strong>{fresh}</strong>
          <span>fresh</span>
        </div>
        <div>
          <strong>{watch}</strong>
          <span>to watch</span>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pantry"
        />
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
        >
          Add item
        </button>
      </div>

      <div className="chip-row" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          className={`chip ${category === 'all' ? 'active' : ''}`}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No items here yet. Scan a receipt, barcode, or add one manually.</p>
        </div>
      ) : (
        <ul className="item-list">
          {filtered.map((item) => {
            const status = getExpiryStatus(item.expiresAt)
            const days = daysUntilExpiry(item.expiresAt)
            return (
              <li key={item.id} className={`item-row status-${status}`}>
                <div className="item-main">
                  <div className="item-title-row">
                    <h2>{item.name}</h2>
                    <span className={`pill status-${status}`}>{statusLabel(status, days)}</span>
                  </div>
                  <p className="item-meta">
                    {item.quantity} {item.unit} · {CATEGORY_LABELS[item.category]}
                    {item.source !== 'manual' ? ` · ${item.source}` : ''}
                  </p>
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setEditing(item)
                      setShowForm(true)
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn ghost" onClick={() => setFinishing(item)}>
                    Finish
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showForm ? (
        <ItemForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSave={(data) => {
            if (editing) updateItem(editing.id, data)
            else addItems([{ ...data, source: 'manual' }])
            setShowForm(false)
          }}
        />
      ) : null}

      {finishing ? (
        <FinishModal
          item={finishing}
          onClose={() => setFinishing(null)}
          onConfirm={(outcome, restock) => {
            finishItem(finishing.id, outcome, restock)
            setFinishing(null)
          }}
        />
      ) : null}
    </section>
  )
}

function FinishModal({
  item,
  onClose,
  onConfirm,
}: {
  item: PantryItem
  onClose: () => void
  onConfirm: (outcome: WasteOutcome, restock: boolean) => void
}) {
  const [restock, setRestock] = useState(false)
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Finished {item.name}?</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          This powers waste insights — used food vs thrown away.
        </p>
        <label className="toggle-row">
          <span>
            <strong>Add to shopping list</strong>
            <small>Restock next time you shop</small>
          </span>
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
        </label>
        <div className="modal-actions wrap">
          <button type="button" className="btn primary" onClick={() => onConfirm('used', restock)}>
            Used it
          </button>
          <button type="button" className="btn ghost danger" onClick={() => onConfirm('thrown', restock)}>
            Threw away
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemForm({
  initial,
  onClose,
  onSave,
}: {
  initial: PantryItem | null
  onClose: () => void
  onSave: (data: Omit<PantryItem, 'id' | 'updatedAt' | 'source'> & { source?: PantryItem['source'] }) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [unit, setUnit] = useState(initial?.unit ?? 'ea')
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'other')
  const [expiresAt, setExpiresAt] = useState(
    initial?.expiresAt ?? estimateExpiry('other').toISOString().slice(0, 10),
  )
  const [purchasedAt, setPurchasedAt] = useState(
    initial?.purchasedAt ?? new Date().toISOString().slice(0, 10),
  )

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-form-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          onSave({
            name: name.trim(),
            quantity,
            unit,
            category,
            expiresAt,
            purchasedAt,
            source: initial?.source,
            barcode: initial?.barcode,
          })
        }}
      >
        <h2 id="item-form-title">{initial ? 'Edit item' : 'Add item'}</h2>
        <label>
          Name
          <input
            required
            value={name}
            onChange={(e) => {
              const next = e.target.value
              setName(next)
              if (!initial) {
                setCategory(guessCategory(next))
                setExpiresAt(estimateExpiry(next).toISOString().slice(0, 10))
              }
            }}
          />
        </label>
        <div className="form-row">
          <label>
            Qty
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <label>
            Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Bought
            <input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
          </label>
          <label>
            Expires
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
