'use client'

import { useMemo, useRef, useSyncExternalStore } from 'react'
import type {
  DesktopAppView,
  DesktopAppId,
  DesktopCoordinate,
  DesktopWindowRuntime,
} from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { useDesktopItemsStore } from '@/store/desktopItems'

type WindowsMap = Record<DesktopAppId, DesktopWindowRuntime>

/** openOrder 仅影响任务栏顺序；窗口层订阅时忽略其变化，避免拖拽排序触发窗口重渲染/DOM 重排 */
function windowsEqualIgnoringOpenOrder(a: WindowsMap, b: WindowsMap): boolean {
  if (a === b) return true
  const idsA = Object.keys(a) as DesktopAppId[]
  const idsB = Object.keys(b) as DesktopAppId[]
  if (idsA.length !== idsB.length) return false
  for (const id of idsA) {
    const x = a[id]
    const y = b[id]
    if (!y) return false
    if (
      x.isOpen !== y.isOpen ||
      x.minimized !== y.minimized ||
      x.active !== y.active ||
      x.zIndex !== y.zIndex ||
      x.bounds !== y.bounds
    ) {
      return false
    }
  }
  return true
}

/** 不依赖 zustand/traditional（需额外 peer dep） */
function useWindowsIgnoringOpenOrder(): WindowsMap {
  const cached = useRef(useWindowStore.getState().windows)
  return useSyncExternalStore(
    useWindowStore.subscribe,
    () => {
      const next = useWindowStore.getState().windows
      if (windowsEqualIgnoringOpenOrder(cached.current, next)) return cached.current
      cached.current = next
      return next
    },
    () => useWindowStore.getState().windows,
  )
}

function mergeDesktopApps(
  definitions: ReturnType<typeof getDesktopAppDefinitionsSnapshot>,
  windows: WindowsMap,
  coordinates: Partial<Record<DesktopAppId, DesktopCoordinate>>,
): DesktopAppView[] {
  return definitions.map((def) => ({
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
  }))
}

/** 合并静态/动态定义 + 窗口状态 + 图标坐标，供桌面 UI 使用（含任务栏 openOrder） */
export function useDesktopApps(): DesktopAppView[] {
  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )
  const windows = useWindowStore((s) => s.windows)
  const coordinates = useDesktopStore((s) => s.coordinates)
  // 订阅桌面项目元数据，rename 后 definition 刷新时一并重算
  const items = useDesktopItemsStore((s) => s.items)

  return useMemo(() => {
    // items：rename 后 definitions 引用可能不变，依赖它强制重算
    void items
    return mergeDesktopApps(definitions, windows, coordinates)
  }, [definitions, windows, coordinates, items])
}

/**
 * 窗口层专用：与 useDesktopApps 相同数据，但 openOrder 变化不触发重渲染。
 */
export function useDesktopWindowApps(): DesktopAppView[] {
  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )
  const windows = useWindowsIgnoringOpenOrder()
  const coordinates = useDesktopStore((s) => s.coordinates)
  const items = useDesktopItemsStore((s) => s.items)

  return useMemo(() => {
    void items
    return mergeDesktopApps(definitions, windows, coordinates)
  }, [definitions, windows, coordinates, items])
}

export function useDesktopHydrated(): boolean {
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const desktopHydrated = useDesktopStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const itemsHydrated = useDesktopItemsStore((s) => s._hasHydrated)
  return windowsHydrated && desktopHydrated && settingsHydrated && itemsHydrated
}
