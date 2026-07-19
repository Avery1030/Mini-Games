'use client'

import { useEffect } from 'react'
import { applyUiScaleToDocument, clearUiScaleFromDocument } from '@/lib/uiScale'
import { useSettingsStore } from '@/store/settings'

/** 根据设置应用文字/图标大小（非整页缩放） */
export function useApplyUiScale() {
  const uiScale = useSettingsStore((s) => s.uiScale)
  const hydrated = useSettingsStore((s) => s._hasHydrated)

  useEffect(() => {
    if (!hydrated) return
    applyUiScaleToDocument(uiScale)
    return () => clearUiScaleFromDocument()
  }, [uiScale, hydrated])
}
