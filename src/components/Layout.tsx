import type { AppView } from '../types'
import { usePantry } from '../hooks/usePantry'
import { useTheme } from '../hooks/useTheme'

const NAV: { id: AppView; label: string; icon: string }[] = [
  { id: 'pantry', label: 'Pantry', icon: '▣' },
  { id: 'scan', label: 'Scan', icon: '◌' },
  { id: 'shop', label: 'Shop', icon: '▤' },
  { id: 'recipes', label: 'Cook', icon: '◈' },
  { id: 'more', label: 'More', icon: '☰' },
]

interface LayoutProps {
  view: AppView
  onNavigate: (view: AppView) => void
  children: React.ReactNode
}

export function Layout({ view, onNavigate, children }: LayoutProps) {
  const { expiringCount, shopCount } = usePantry()
  const { theme, resolved, cycleTheme } = useTheme()

  const themeLabel =
    theme === 'system' ? `Auto (${resolved})` : theme === 'dark' ? 'Dark' : 'Light'

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-block">
          <p className="brand">SeamlessShop</p>
          <p className="brand-tag">Know what’s in your kitchen</p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={cycleTheme}
          aria-label={`Theme: ${themeLabel}. Click to change.`}
          title={themeLabel}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            {resolved === 'dark' ? '☾' : '☀'}
          </span>
          <span className="theme-toggle-label">{theme === 'system' ? 'Auto' : themeLabel}</span>
        </button>
      </header>

      <main className="main-panel">{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-btn ${view === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.id === 'more' && expiringCount > 0 ? (
              <span className="nav-badge">{expiringCount}</span>
            ) : null}
            {item.id === 'shop' && shopCount > 0 ? (
              <span className="nav-badge">{shopCount}</span>
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  )
}
