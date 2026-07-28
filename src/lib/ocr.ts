import type { Worker } from 'tesseract.js'

type ProgressFn = (pct: number) => void

let workerPromise: Promise<Worker> | null = null
let lastProgress: ProgressFn | undefined

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            lastProgress?.(Math.round(m.progress * 100))
          }
        },
      }) as Promise<Worker>
    })()
  }
  return workerPromise
}

/** Reuses one OCR worker across scans (much faster after the first). */
export async function recognizeText(
  image: File | Blob | string,
  onProgress?: ProgressFn,
): Promise<string> {
  lastProgress = onProgress
  onProgress?.(2)
  const worker = await getWorker()
  onProgress?.(8)
  const { data } = await worker.recognize(image)
  lastProgress = undefined
  return data.text
}

/** Warm the OCR worker during idle time so the first scan feels instant. */
export function prefetchOcr(): void {
  const run = () => {
    void getWorker().catch(() => {
      workerPromise = null
    })
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 4000 })
  } else {
    window.setTimeout(run, 1500)
  }
}
