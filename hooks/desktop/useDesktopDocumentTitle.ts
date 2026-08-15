'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { useTitle } from 'ahooks'
import { useLocale, useTranslations } from 'next-intl'
import type { DesktopAppId, DesktopWindowRuntime } from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  resolveDesktopItemTitle,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
import { useLockStore } from '@/store/lock'
import { useWindowStore } from '@/store/window'

/** 与 `app/(desktop)/layout.tsx` metadata.title 保持一致 */
export const DESKTOP_DOCUMENT_TITLE = 'Avery Mini OS'

function selectActiveWindowId(windows: Record<string, DesktopWindowRuntime>): DesktopAppId | null {
  for (const [id, w] of Object.entries(windows)) {
    if (w.isOpen && w.active && !w.minimized) return id
  }
  return null
}

/**
 * 浏览器标签页标题跟随当前活跃窗口。
 * 无可见焦点、未水合或锁屏时回落到系统名。
 */
export function useDesktopDocumentTitle() {
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const lockHydrated = useLockStore((s) => s._hasHydrated)
  const isLocked = useLockStore((s) => s.isLocked)
  const activeId = useWindowStore((s) => selectActiveWindowId(s.windows))
  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )

  const title = useMemo(() => {
    if (!windowsHydrated || !lockHydrated || isLocked || !activeId) return DESKTOP_DOCUMENT_TITLE
    const app = definitions.find((d) => d.id === activeId)
    if (!app) return DESKTOP_DOCUMENT_TITLE
    const winTitle = resolveDesktopItemTitle(app, tApps, locale).trim()
    if (!winTitle) return DESKTOP_DOCUMENT_TITLE
    return `${winTitle} - ${DESKTOP_DOCUMENT_TITLE}`
  }, [activeId, definitions, isLocked, locale, lockHydrated, tApps, windowsHydrated])

  useTitle(title)
}

/** 独立挂载，避免标题订阅带动 DesktopShell 重渲染 */
export function DesktopDocumentTitle() {
  useDesktopDocumentTitle()
  return null
}
