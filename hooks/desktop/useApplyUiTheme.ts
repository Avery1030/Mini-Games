'use client'

import { useEffect } from 'react'
import { applyUiThemeToDocument, clearUiThemeFromDocument } from '@/lib/uiTheme'
import { useSettingsStore } from '@/store/settings'

/** 把设置里的 UI 风格/配色写到 <html> */
export function useApplyUiTheme() {
  const uiStyle = useSettingsStore((s) => s.uiStyle)
  const uiPalette = useSettingsStore((s) => s.uiPalette)
  const customUiTheme = useSettingsStore((s) => s.customUiTheme)
  const hydrated = useSettingsStore((s) => s._hasHydrated)

  useEffect(() => {
    if (!hydrated) return
    applyUiThemeToDocument(uiStyle, uiPalette, customUiTheme)
    return () => clearUiThemeFromDocument()
  }, [uiStyle, uiPalette, customUiTheme, hydrated])
}
