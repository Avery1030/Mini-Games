'use client'

import { useMemo } from 'react'
import {
  DESKTOP_APP_DEFINITIONS,
  type DesktopAppView,
} from '@/config/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'

/** 合并静态定义 + 窗口状态 + 图标坐标，供桌面 UI 使用 */
export function useDesktopApps(): DesktopAppView[] {
  const windows = useWindowStore((s) => s.windows)
  const coordinates = useDesktopStore((s) => s.coordinates)

  return useMemo(
    () =>
      DESKTOP_APP_DEFINITIONS.map((def) => ({
        ...def,
        ...(windows[def.id] ?? {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
          openOrder: 0,
        }),
        coordinate: coordinates[def.id] ?? def.defaultCoordinate,
      })),
    [windows, coordinates],
  )
}

export function useDesktopHydrated(): boolean {
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const desktopHydrated = useDesktopStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  return windowsHydrated && desktopHydrated && settingsHydrated
}
