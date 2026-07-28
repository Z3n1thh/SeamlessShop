import { useEffect, useRef, useState } from 'react'
import type { ScannedItem } from '../types'
import { usePantry } from '../hooks/usePantry'
import { CATEGORY_LABELS } from '../lib/expiry'
import { scanReceiptImage, scanReceiptImages } from '../lib/receiptParser'
import { lookupBarcode, productToScanned } from '../lib/openFoodFacts'
import { scanPackageForExpiry } from '../lib/dateOcr'
import { findPantryMatch } from '../lib/groceryMatch'
import { prefetchOcr } from '../lib/ocr'

type ScanMode = 'receipt' | 'barcode' | 'package'

export function ScanView() {
  const { addOrMergeItems, markShoppingBought, items } = usePantry()
  const inputRef = useRef<HTMLInputElement>(null)
  const multiInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>('receipt')
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState<ScannedItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanningBarcode, setScanningBarcode] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [photoCount, setPhotoCount] = useState(0)

  useEffect(() => {
    prefetchOcr()
  }, [])

  async function handleFiles(fileList: FileList | File[] | null | undefined) {
    const files = fileList ? [...fileList].filter((f) => f.type.startsWith('image/')) : []
    if (!files.length) return

    setError(null)
    setScanned(null)
    setBusy(true)
    setProgress(0)
    setPhotoCount(files.length)
    setPreview(URL.createObjectURL(files[0]))

    try {
      if (mode === 'package') {
        const { expiresAt } = await scanPackageForExpiry(files[0], setProgress)
        if (!expiresAt) {
          setError('Couldn’t find an expiry date. Try a clearer photo of the date stamp.')
        } else {
          setScanned([
            {
              name: 'Package item',
              quantity: 1,
              unit: 'ea',
              category: 'other',
              expiresAt,
              selected: true,
              source: 'package',
            },
          ])
        }
      } else if (files.length === 1) {
        setScanned(await scanReceiptImage(files[0], setProgress))
      } else {
        setScanned(await scanReceiptImages(files, setProgress))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function resolveBarcode(code: string) {
    setBusy(true)
    setError(null)
    try {
      const product = await lookupBarcode(code)
      if (!product) {
        setError('No product found for that barcode in Open Food Facts.')
        return
      }
      setScanned([productToScanned(product)])
      setPreview(product.image ?? null)
      setPhotoCount(1)
    } catch {
      setError('Barcode lookup failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function toggle(index: number) {
    setScanned((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item)) : prev,
    )
  }

  function selectAll(selected: boolean) {
    setScanned((prev) => (prev ? prev.map((item) => ({ ...item, selected })) : prev))
  }

  function updateName(index: number, name: string) {
    setScanned((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, name } : item)) : prev,
    )
  }

  function updateExpiry(index: number, expiresAt: string) {
    setScanned((prev) =>
      prev ? prev.map((item, i) => (i === index ? { ...item, expiresAt } : item)) : prev,
    )
  }

  function confirmAll() {
    if (!scanned) return
    const selected = scanned.filter((i) => i.selected && i.name.trim())
    if (!selected.length) return
    const today = new Date().toISOString().slice(0, 10)
    const { added, merged } = addOrMergeItems(
      selected.map((i) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        purchasedAt: today,
        expiresAt: i.expiresAt,
        source: i.source ?? 'scan',
        barcode: i.barcode,
      })),
    )
    markShoppingBought(selected.map((i) => i.name))
    setToast(
      merged
        ? `Added ${added} new · updated ${merged} already in pantry`
        : `Added all ${added} groceries to your pantry`,
    )
    window.setTimeout(() => setToast(null), 3200)
    setScanned(null)
    setPreview(null)
    setPhotoCount(0)
  }

  const selectedCount = scanned?.filter((i) => i.selected).length ?? 0

  return (
    <section className="view scan-view">
      <div className="view-hero">
        <h1>Scan groceries</h1>
        <p>Photograph your receipt once — we’ll match and add everything you bought.</p>
      </div>

      <div className="chip-row" role="tablist" aria-label="Scan mode">
        {(
          [
            ['receipt', 'Whole receipt'],
            ['barcode', 'Barcode'],
            ['package', 'Package date'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`chip ${mode === id ? 'active' : ''}`}
            onClick={() => {
              setMode(id)
              setError(null)
              setScanned(null)
              setPreview(null)
              setScanningBarcode(false)
              setPhotoCount(0)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {toast ? <p className="toast">{toast}</p> : null}

      {mode === 'barcode' ? (
        <div className="scan-results" style={{ marginBottom: '0.9rem' }}>
          <div className="toolbar">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => setScanningBarcode((v) => !v)}
            >
              {scanningBarcode ? 'Stop camera' : 'Scan with camera'}
            </button>
          </div>
          {scanningBarcode ? (
            <BarcodeCamera
              onDetected={(code) => {
                setScanningBarcode(false)
                void resolveBarcode(code)
              }}
              onError={setError}
            />
          ) : null}
          <form
            className="toolbar"
            onSubmit={(e) => {
              e.preventDefault()
              if (manualCode.trim()) void resolveBarcode(manualCode.trim())
            }}
          >
            <input
              className="search"
              placeholder="Or type barcode…"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              inputMode="numeric"
            />
            <button type="submit" className="btn ghost" disabled={busy}>
              Look up
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="scan-stage receipt-drop">
            {preview ? (
              <img src={preview} alt="Scan preview" className="receipt-preview" />
            ) : (
              <button
                type="button"
                className="scan-placeholder as-button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <span className="scan-glyph" aria-hidden="true">
                  ⌗
                </span>
                <strong>
                  {mode === 'package' ? 'Photo the use-by date' : 'Tap to scan your receipt'}
                </strong>
                <p>
                  {mode === 'package'
                    ? 'We’ll read the expiry stamp'
                    : 'One photo of the whole list — or add several photos at once'}
                </p>
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={multiInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ''
            }}
          />

          <div className="toolbar">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Reading receipt…' : preview ? 'Scan another receipt' : 'Take / upload receipt'}
            </button>
            {mode === 'receipt' ? (
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() => multiInputRef.current?.click()}
              >
                Multi photos
              </button>
            ) : null}
          </div>
          {photoCount > 1 ? (
            <p className="hint" style={{ marginTop: 0 }}>
              Combining {photoCount} receipt photos into one grocery list…
            </p>
          ) : null}
        </>
      )}

      {progress !== null ? (
        <div className="progress-wrap" aria-live="polite">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>Reading groceries… {progress}%</span>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {scanned ? (
        <div className="scan-results">
          <div className="results-head">
            <h2>{selectedCount} groceries found</h2>
            <p>
              Matched to common grocery names when possible. One tap adds everything — duplicates already
              in your pantry get quantity updates.
            </p>
          </div>

          <div className="toolbar">
            <button type="button" className="btn ghost" onClick={() => selectAll(true)}>
              Select all
            </button>
            <button type="button" className="btn ghost" onClick={() => selectAll(false)}>
              Select none
            </button>
          </div>

          <ul className="scan-list">
            {scanned.map((item, index) => {
              const already = findPantryMatch(
                item.name,
                items.map((i) => i.name),
              )
              return (
                <li key={`${item.name}-${index}`} className="scan-row">
                  <label className="check">
                    <input type="checkbox" checked={item.selected} onChange={() => toggle(index)} />
                    <span className="sr-only">Include {item.name}</span>
                  </label>
                  <div className="scan-fields">
                    <input
                      value={item.name}
                      onChange={(e) => updateName(index, e.target.value)}
                      aria-label="Item name"
                    />
                    <div className="scan-meta">
                      <span>
                        {CATEGORY_LABELS[item.category]}
                        {item.quantity > 1 ? ` · ×${item.quantity}` : ''}
                        {already ? ' · in pantry' : ''}
                      </span>
                      <input
                        type="date"
                        value={item.expiresAt}
                        onChange={(e) => updateExpiry(index, e.target.value)}
                        aria-label="Expiry"
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            className="btn primary wide sticky-add"
            disabled={!selectedCount}
            onClick={confirmAll}
          >
            Add all {selectedCount} to pantry
          </button>
        </div>
      ) : null}

      <p className="hint">
        Tip: lay the receipt flat in good light. OCR runs on your device. Shopping-list items that match
        get checked off automatically.
      </p>
    </section>
  )
}

function BarcodeCamera({
  onDetected,
  onError,
}: {
  onDetected: (code: string) => void
  onError: (msg: string) => void
}) {
  const started = useRef(false)

  useEffect(() => {
    const id = 'barcode-reader'
    let alive = true
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null

    void (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!alive) return
        const instance = new Html5Qrcode(id)
        scanner = instance
        await instance.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 260, height: 140 } },
          (decoded) => {
            if (!alive || started.current) return
            started.current = true
            void instance
              .stop()
              .catch(() => undefined)
              .finally(() => onDetected(decoded))
          },
          () => undefined,
        )
      } catch {
        onError('Camera access failed. Type the barcode instead.')
      }
    })()

    return () => {
      alive = false
      void scanner
        ?.stop()
        .catch(() => undefined)
        .finally(() => {
          try {
            scanner?.clear()
          } catch {
            /* ignore */
          }
        })
    }
  }, [onDetected, onError])

  return <div id="barcode-reader" className="barcode-reader" />
}
