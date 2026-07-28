import { useEffect, useMemo } from 'react'
import { usePantry } from '../hooks/usePantry'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

/** Applies light/dark tokens to <html> and keeps meta theme-color in sync. */
export function useTheme() {
  const { settings, setSettings } = usePantry()

  const resolved = useMemo(() => resolveTheme(settings.theme ?? 'system'), [settings.theme])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.colorScheme = resolved

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0c1410' : '#1f4d3a')

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if ((settings.theme ?? 'system') === 'system') {
        const next = mq.matches ? 'dark' : 'light'
        root.dataset.theme = next
        root.style.colorScheme = next
        if (meta) meta.setAttribute('content', next === 'dark' ? '#0c1410' : '#1f4d3a')
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [resolved, settings.theme])

  function cycleTheme() {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const current = settings.theme ?? 'system'
    const next = order[(order.indexOf(current) + 1) % order.length]
    void setSettings({ theme: next })
  }

  return {
    theme: settings.theme ?? 'system',
    resolved,
    cycleTheme,
    setTheme: (theme: 'light' | 'dark' | 'system') => void setSettings({ theme }),
  }
}
