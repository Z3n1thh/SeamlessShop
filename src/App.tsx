import { useState } from 'react'
import type { AppView } from './types'
import { PantryProvider } from './hooks/usePantry'
import { Layout } from './components/Layout'
import { PantryView } from './components/PantryView'
import { ScanView } from './components/ScanView'
import { ShopView } from './components/ShopView'
import { RecipesView } from './components/RecipesView'
import { MoreView } from './components/MoreView'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>('pantry')

  return (
    <PantryProvider>
      <Layout view={view} onNavigate={setView}>
        {view === 'pantry' ? <PantryView /> : null}
        {view === 'scan' ? <ScanView /> : null}
        {view === 'shop' ? <ShopView /> : null}
        {view === 'recipes' ? <RecipesView /> : null}
        {view === 'more' ? <MoreView /> : null}
      </Layout>
    </PantryProvider>
  )
}

export default App
