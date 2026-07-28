'use client'

import { useEffect } from 'react'
import { applyUiScaleToDocument, clearUiScaleFromDocument, type UiScale } from '@/lib/uiScale'
import { useSettingsStore } from '@/store/settings'
import { useIsMobileViewport } from './useIsMobileViewport'

/** 手机端限制过大缩放，避免网格撑爆 */
function resolveScaleForViewport(scale: UiScale, isMobile: boolean): UiScale {
  if (!isMobile) return scale
  if (scale === 'xl' || scale === '2xl' || scale === '3xl' || scale === 'lg') return 'md'
  return scale
}

/** 根据设置应用文字/图标大小（非整页缩放）；窄屏自动封顶 */
export function useApplyUiScale() {
  const uiScale = useSettingsStore((s) => s.uiScale)
  const hydrated = useSettingsStore((s) => s._hasHydrated)
  const isMobile = useIsMobileViewport()

  useEffect(() => {
    if (!hydrated) return
    applyUiScaleToDocument(resolveScaleForViewport(uiScale, isMobile))
    return () => clearUiScaleFromDocument()
  }, [uiScale, hydrated, isMobile])
}
