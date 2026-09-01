'use client'

import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { DesktopAppId, DesktopWindowRuntime } from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  resolveDesktopItemTitle,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
import {
  DESKTOP_DOCUMENT_TITLE,
  formatDesktopDocumentTitle,
} from '@/lib/desktop/documentTitle'
import { parseWindowPath } from '@/lib/desktop/windowRoute'
import { useLockStore } from '@/store/lock'
import { useWindowStore } from '@/store/window'

export { DESKTOP_DOCUMENT_TITLE }

function selectActiveWindowId(windows: Record<string, DesktopWindowRuntime>): Nullable<DesktopAppId> {
  for (const [id, w] of Object.entries(windows)) {
    if (w.isOpen && w.active && !w.minimized) return id
  }
  return null
}

function subscribePathname(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function titleFromAppId(
  id: DesktopAppId,
  definitions: ReturnType<typeof getDesktopAppDefinitionsSnapshot>,
  tApps: (key: string) => string,
  locale: string,
): Nullable<string> {
  const app = definitions.find((d) => d.id === id)
  if (app) {
    const winTitle = resolveDesktopItemTitle(app, tApps, locale).trim()
    if (winTitle) return formatDesktopDocumentTitle(winTitle)
  }
  try {
    const v = tApps(id)
    if (v && v !== id && !v.startsWith('apps.')) return formatDesktopDocumentTitle(v)
  } catch {
    /* missing key */
  }
  return null
}

/**
 * 浏览器标签页标题跟随当前活跃窗口；深链刷新时也可先用 URL slug。
 * 锁屏时回落到系统名。
 */
export function useDesktopDocumentTitle(): string {
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
  const pathname = useSyncExternalStore(subscribePathname, () => window.location.pathname, () => '/')

  return useMemo(() => {
    if (lockHydrated && isLocked) return DESKTOP_DOCUMENT_TITLE

    if (windowsHydrated && activeId) {
      const fromActive = titleFromAppId(activeId, definitions, tApps, locale)
      if (fromActive) return fromActive
    }

    const route = parseWindowPath(pathname)
    if (route.type === 'window') {
      const fromRoute = titleFromAppId(route.id, definitions, tApps, locale)
      if (fromRoute) return fromRoute
    }

    return DESKTOP_DOCUMENT_TITLE
  }, [activeId, definitions, isLocked, locale, lockHydrated, pathname, tApps, windowsHydrated])
}

/** Next metadata 会反复把 `<title>` 写回默认值；这里在 head 被改时再写回当前窗口名。 */
function useCommittedDocumentTitle(title: string) {
  useLayoutEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title
    }
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(document.head, { subtree: true, childList: true, characterData: true })
    return () => observer.disconnect()
  }, [title])
}

/** 独立挂载，避免标题订阅带动 DesktopShell 重渲染。不渲染 `<title>`，避免和 Next metadata 抢第一个 title 节点。 */
export function DesktopDocumentTitle() {
  const title = useDesktopDocumentTitle()
  useCommittedDocumentTitle(title)
  return null
}
