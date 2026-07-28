import { lazy, Suspense, startTransition, useState } from 'react'
import type { AppView } from './types'
import { PantryProvider } from './hooks/usePantry'
import { Layout } from './components/Layout'
import { PantryView } from './components/PantryView'
import './App.css'

const ScanView = lazy(() =>
  import('./components/ScanView').then((m) => ({ default: m.ScanView })),
)
const ShopView = lazy(() =>
  import('./components/ShopView').then((m) => ({ default: m.ShopView })),
)
const RecipesView = lazy(() =>
  import('./components/RecipesView').then((m) => ({ default: m.RecipesView })),
)
const MoreView = lazy(() =>
  import('./components/MoreView').then((m) => ({ default: m.MoreView })),
)

function ViewFallback() {
  return (
    <div className="view-fallback" role="status" aria-live="polite">
      Loading…
    </div>
  )
}

function App() {
  const [view, setView] = useState<AppView>('pantry')

  function navigate(next: AppView) {
    startTransition(() => setView(next))
    // Warm heavy scan/OCR chunk when user opens Scan
    if (next === 'scan') {
      void import('./lib/ocr').then((m) => m.prefetchOcr())
    }
  }

  return (
    <PantryProvider>
      <Layout view={view} onNavigate={navigate}>
        <Suspense fallback={<ViewFallback />}>
          {view === 'pantry' ? <PantryView /> : null}
          {view === 'scan' ? <ScanView /> : null}
          {view === 'shop' ? <ShopView /> : null}
          {view === 'recipes' ? <RecipesView /> : null}
          {view === 'more' ? <MoreView /> : null}
        </Suspense>
      </Layout>
    </PantryProvider>
  )
}

export default App
