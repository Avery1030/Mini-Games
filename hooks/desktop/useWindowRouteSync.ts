'use client'

import { useEffect, useRef } from 'react'
import type { DesktopAppId, DesktopWindowRuntime } from '@/config/desktop'
import { ensureIdeEditorWindow, getDesktopWindow } from '@/lib/desktop/window'
import { parseWindowPath, setWindowUrl } from '@/lib/desktop/windowRoute'
import { useDesktopHydrated } from '@/hooks/desktop/useDesktopApps'
import { useWindowStore } from '@/store/window'

function getFocusedWindowId(
  windows: Record<string, DesktopWindowRuntime>,
): DesktopAppId | null {
  for (const [id, w] of Object.entries(windows)) {
    if (w.isOpen && !w.minimized && w.active) return id as DesktopAppId
  }
  return null
}

function blurAllWindows(): void {
  const { windows } = useWindowStore.getState()
  let changed = false
  const next = { ...windows }
  for (const id of Object.keys(next) as DesktopAppId[]) {
    const w = next[id]
    if (!w?.active) continue
    next[id] = { ...w, active: false }
    changed = true
  }
  if (changed) useWindowStore.setState({ windows: next })
}

/**
 * 将当前聚焦窗口同步到 `/window/[slug]`（无刷新 pushState），
 * 并在 popstate / 深链首屏时按 URL 打开或聚焦窗口。
 */
export function useWindowRouteSync(enabled: boolean): void {
  const hydrated = useDesktopHydrated()
  const ready = enabled && hydrated
  const applyingFromUrlRef = useRef(false)
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    if (!ready || bootstrappedRef.current) return
    bootstrappedRef.current = true

    const route = parseWindowPath(window.location.pathname)
    applyingFromUrlRef.current = true
    try {
      if (route.type === 'window') {
        if (route.id.startsWith('ide_')) ensureIdeEditorWindow(route.id)
        const deskWin = getDesktopWindow(route.id)
        if (deskWin?.app) {
          useWindowStore.getState().openWindow(route.id)
        } else {
          const focused = getFocusedWindowId(useWindowStore.getState().windows)
          setWindowUrl(focused, 'replace')
        }
      } else if (route.type === 'desktop') {
        // 首屏落在 /：用 persist 焦点校正地址栏，不 blur
        const focused = getFocusedWindowId(useWindowStore.getState().windows)
        if (focused) setWindowUrl(focused, 'replace')
      }
    } finally {
      applyingFromUrlRef.current = false
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return

    const syncStoreToUrl = () => {
      if (applyingFromUrlRef.current) return
      const focused = getFocusedWindowId(useWindowStore.getState().windows)
      const route = parseWindowPath(window.location.pathname)
      if (route.type === 'foreign') return
      setWindowUrl(focused, 'push')
    }

    const unsub = useWindowStore.subscribe((state, prev) => {
      if (state.windows === prev.windows) return
      syncStoreToUrl()
    })

    const onPopState = () => {
      const route = parseWindowPath(window.location.pathname)
      if (route.type === 'foreign') return

      applyingFromUrlRef.current = true
      try {
        if (route.type === 'window') {
          if (route.id.startsWith('ide_')) ensureIdeEditorWindow(route.id)
          const deskWin = getDesktopWindow(route.id)
          if (deskWin?.app) {
            useWindowStore.getState().openWindow(route.id)
          } else {
            blurAllWindows()
            setWindowUrl(null, 'replace')
          }
        } else {
          blurAllWindows()
        }
      } finally {
        // openWindow 可能同步改 store；延后清旗，避免立刻 push 新历史
        queueMicrotask(() => {
          applyingFromUrlRef.current = false
        })
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      unsub()
      window.removeEventListener('popstate', onPopState)
    }
  }, [ready])
}
