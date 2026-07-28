import { useMemo, useState } from 'react'
import { usePantry } from '../hooks/usePantry'
import { groupShoppingByAisle } from '../lib/aisles'

export function ShopView() {
  const {
    shopping,
    addShopping,
    toggleShopping,
    removeShopping,
    clearCheckedShopping,
    buyShoppingToPantry,
  } = usePantry()
  const [name, setName] = useState('')
  const [storeMode, setStoreMode] = useState(false)

  const open = shopping.filter((s) => !s.checked)
  const done = shopping.filter((s) => s.checked)
  const aisleGroups = useMemo(() => groupShoppingByAisle(open), [open])

  return (
    <section className={`view shop-view ${storeMode ? 'store-mode' : ''}`}>
      <div className="view-hero">
        <h1>Shopping list</h1>
        <p>Grouped by store aisle — check off as you walk the store.</p>
      </div>

      <div className="toolbar">
        <button
          type="button"
          className={`btn ${storeMode ? 'primary' : 'ghost'}`}
          onClick={() => setStoreMode((v) => !v)}
        >
          {storeMode ? 'Exit store mode' : 'Store mode'}
        </button>
      </div>

      {!storeMode ? (
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            addShopping([{ name: name.trim() }])
            setName('')
          }}
        >
          <input
            className="search"
            placeholder="Add something to buy…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New shopping item"
          />
          <button type="submit" className="btn primary">
            Add
          </button>
        </form>
      ) : null}

      {!shopping.length ? (
        <div className="empty">
          <p>List is empty. Finish a pantry item with restock, or add missing ingredients from Cook.</p>
        </div>
      ) : (
        <>
          {aisleGroups.map(({ aisle, items }) => (
            <div key={aisle} className="aisle-group">
              <h2>{aisle}</h2>
              <ul className="item-list">
                {items.map((item) => (
                  <li key={item.id} className={`item-row shop-row ${storeMode ? 'store-row' : ''}`}>
                    <label className="shop-check">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleShopping(item.id)}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.quantity} {item.unit}
                          {item.fromRecipe ? ` · from ${item.fromRecipe}` : ''}
                        </small>
                      </span>
                    </label>
                    {!storeMode ? (
                      <button
                        type="button"
                        className="btn ghost danger"
                        onClick={() => removeShopping(item.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {done.length > 0 ? (
            <div className="alert-group" style={{ marginTop: '1.25rem' }}>
              <h2>Checked off</h2>
              <ul className="item-list">
                {done.map((item) => (
                  <li key={item.id} className="item-row shop-row checked">
                    <label className="shop-check">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleShopping(item.id)}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.quantity} {item.unit}
                        </small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="toolbar">
                <button type="button" className="btn primary" onClick={buyShoppingToPantry}>
                  Move checked to pantry
                </button>
                <button type="button" className="btn ghost" onClick={clearCheckedShopping}>
                  Clear checked
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
