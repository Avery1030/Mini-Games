'use client'

import { useSyncExternalStore } from 'react'
import { isServer } from '@/lib/env'

/** 与 Tailwind `md` 对齐：&lt;768px 为手机壳 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

function subscribeQuery(query: string, onStoreChange: () => void): () => void {
  if (isServer) return () => {}
  const mql = window.matchMedia(query)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

/**
 * 订阅 `window.matchMedia`。SSR / 首帧返回 `serverSnapshot`，避免 hydration 错端。
 */
export function useMediaQuery(query: string, serverSnapshot = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeQuery(query, onStoreChange),
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  )
}

/**
 * 窄屏手机桌面（&lt;768px）。SSR / 首帧为 false，避免 hydration 错端。
 */
export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_VIEWPORT_QUERY)
}
