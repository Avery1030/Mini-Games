import type { DesktopAppId } from '@/config/desktop'

export const WINDOW_ROUTE_STATE_KEY = '__windowRoute' as const

export type WindowHistoryState = {
  [WINDOW_ROUTE_STATE_KEY]?: true
}

export type WindowRoute =
  | { type: 'desktop' }
  | { type: 'window'; id: DesktopAppId }
  | { type: 'foreign' }

/** 聚焦窗口对应的 path；无聚焦时为桌面根路径。 */
export function windowPath(id: DesktopAppId | null): string {
  if (!id) return '/'
  return `/window/${encodeURIComponent(id)}`
}

/** 解析地址栏 path：仅识别 `/` 与 `/window/[slug]`。 */
export function parseWindowPath(pathname: string): WindowRoute {
  if (pathname === '/' || pathname === '') return { type: 'desktop' }
  const match = /^\/window\/([^/]+)\/?$/.exec(pathname)
  if (!match) return { type: 'foreign' }
  try {
    return { type: 'window', id: decodeURIComponent(match[1]) as DesktopAppId }
  } catch {
    return { type: 'foreign' }
  }
}

export function setWindowUrl(id: DesktopAppId | null, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined') return
  const path = windowPath(id)
  if (window.location.pathname === path) return
  const state: WindowHistoryState = { [WINDOW_ROUTE_STATE_KEY]: true }
  if (mode === 'replace') {
    window.history.replaceState(state, '', path)
  } else {
    window.history.pushState(state, '', path)
  }
}
