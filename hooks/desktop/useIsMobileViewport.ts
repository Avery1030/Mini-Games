'use client'

import { useSyncExternalStore } from 'react'

/** 与 Tailwind `md` 对齐：&lt;768px 为手机壳 */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(MOBILE_VIEWPORT_QUERY)
  mql.addEventListener('change', onStoreChange)
  return () => mql.removeEventListener('change', onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * 窄屏手机桌面（&lt;768px）。SSR / 首帧为 false，避免 hydration 错端。
 */
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
