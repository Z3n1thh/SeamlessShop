import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import type { ScannedItem } from '../types'
import { usePantry } from '../hooks/usePantry'
import { CATEGORY_LABELS } from '../lib/expiry'
import { scanReceiptImage } from '../lib/receiptParser'
import { lookupBarcode, productToScanned } from '../lib/openFoodFacts'
import { scanPackageForExpiry } from '../lib/dateOcr'

type ScanMode = 'receipt' | 'barcode' | 'package'

export function ScanView() {
  const { addItems } = usePantry()
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ScanMode>('barcode')
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanned, setScanned] = useState<ScannedItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scanningBarcode, setScanningBarcode] = useState(true)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setScanned(null)
    setBusy(true)
    setProgress(0)
    const url = URL.createObjectURL(file)
    setPreview(url)

    try {
      if (mode === 'package') {
        const { expiresAt } = await scanPackageForExpiry(file, setProgress)
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
      } else {
        const items = await scanReceiptImage(file, setProgress)
        setScanned(items)
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

  function confirm() {
    if (!scanned) return
    const selected = scanned.filter((i) => i.selected && i.name.trim())
    const today = new Date().toISOString().slice(0, 10)
    addItems(
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
    setScanned(null)
    setPreview(null)
  }

  return (
    <section className="view scan-view">
      <div className="view-hero">
        <h1>Scan</h1>
        <p>Receipts, barcodes, or package dates — all on-device or free APIs.</p>
      </div>

      <div className="chip-row" role="tablist" aria-label="Scan mode">
        {(
          [
            ['barcode', 'Barcode'],
            ['receipt', 'Receipt'],
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
            }}
          >
            {label}
          </button>
        ))}
      </div>

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
          <div className="scan-stage">
            {preview ? (
              <img src={preview} alt="Scan preview" className="receipt-preview" />
            ) : (
              <div className="scan-placeholder">
                <span className="scan-glyph" aria-hidden="true">
                  ⌗
                </span>
                <p>
                  {mode === 'package'
                    ? 'Photo the best-before / use-by stamp'
                    : 'Works with phone camera or any image upload'}
                </p>
              </div>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          <div className="toolbar">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Reading…' : preview ? 'Scan another' : 'Take or upload photo'}
            </button>
          </div>
        </>
      )}

      {progress !== null ? (
        <div className="progress-wrap" aria-live="polite">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span>Reading… {progress}%</span>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {scanned ? (
        <div className="scan-results">
          <div className="results-head">
            <h2>Confirm items</h2>
            <p>
              {mode === 'package'
                ? 'Name the item and confirm the date we found.'
                : 'Uncheck anything that isn’t food, then add to pantry.'}
            </p>
          </div>
          <ul className="scan-list">
            {scanned.map((item, index) => (
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
                    <span>{CATEGORY_LABELS[item.category]}</span>
                    <input
                      type="date"
                      value={item.expiresAt}
                      onChange={(e) => updateExpiry(index, e.target.value)}
                      aria-label="Expiry"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="btn primary wide" onClick={confirm}>
            Add {scanned.filter((i) => i.selected).length} to pantry
          </button>
        </div>
      ) : null}

      <p className="hint">
        Receipt/package OCR uses Tesseract.js on your device. Barcodes use Open Food Facts (free, no
        key). Expiry dates from receipts are estimated unless a date stamp is found.
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
    const scanner = new Html5Qrcode(id)
    let alive = true

    void (async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 260, height: 140 } },
          (decoded) => {
            if (!alive || started.current) return
            started.current = true
            void scanner
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
      void scanner.stop().catch(() => undefined)
      try {
        scanner.clear()
      } catch {
        /* ignore */
      }
    }
  }, [onDetected, onError])

  return <div id="barcode-reader" className="barcode-reader" />
}
