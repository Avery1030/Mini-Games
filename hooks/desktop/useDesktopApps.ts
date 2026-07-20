'use client'

import { useMemo, useSyncExternalStore } from 'react'
import type { DesktopAppView } from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { useDesktopItemsStore } from '@/store/desktopItems'

/** 合并静态/动态定义 + 窗口状态 + 图标坐标，供桌面 UI 使用 */
export function useDesktopApps(): DesktopAppView[] {
  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )
  const windows = useWindowStore((s) => s.windows)
  const coordinates = useDesktopStore((s) => s.coordinates)
  // 订阅文件夹元数据，rename 后 definition 刷新时一并重算
  const folders = useDesktopItemsStore((s) => s.folders)

  return useMemo(
    () =>
      definitions.map((def) => ({
        ...def,
        ...(windows[def.id] ?? {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
          openOrder: 0,
          bounds: null,
        }),
        coordinate: coordinates[def.id] ?? def.defaultCoordinate,
      })),
    [definitions, windows, coordinates, folders],
  )
}

export function useDesktopHydrated(): boolean {
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const desktopHydrated = useDesktopStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const itemsHydrated = useDesktopItemsStore((s) => s._hasHydrated)
  return windowsHydrated && desktopHydrated && settingsHydrated && itemsHydrated
}
