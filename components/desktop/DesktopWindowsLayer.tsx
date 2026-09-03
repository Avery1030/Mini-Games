'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { WindowsWindow } from './WindowsWindow'
import { useDesktopWindowApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { DEFAULT_WINDOW_CHROME } from '@/config/desktop'
import { getCascadedPosition } from '@/lib/desktop'
import { getDesktopWindow, resolveDesktopItemTitle } from '@/lib/desktop/window'

/**
 * 已打开窗口层：自行订阅 window/desktop 合并视图，与图标层解耦。
 * 排序与订阅均忽略 openOrder（任务栏专用），避免任务栏拖拽触发窗口重渲染。
 */
export function DesktopWindowsLayer() {
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const apps = useDesktopWindowApps()
  const hasHydrated = useDesktopHydrated()
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const updateWindowBounds = useWindowStore((s) => s.updateWindowBounds)
  const openWindowsMaximized = useSettingsStore((s) => s.openWindowsMaximized)

  const openApps = useMemo(
    () =>
      hasHydrated
        ? apps
            .filter((app) => app.isOpen)
            .slice()
            .sort((a, b) => a.openOrder - b.openOrder || String(a.id).localeCompare(String(b.id)))
        : [],
    [hasHydrated, apps],
  )

  return (
    <>
      {openApps.map((app) => {
        if (!app.app) return null
        const App = app.app
        const deskWin = getDesktopWindow(app.id)
        const chrome = deskWin?.chrome ?? app.chrome ?? DEFAULT_WINDOW_CHROME
        const remembered = app.bounds
        const width = remembered?.width ?? app.width ?? 400
        const height = remembered?.height ?? app.height ?? 320
        const cascadeIndex = openApps.filter((item) => item.zIndex < app.zIndex).length
        const defaultPosition = remembered
          ? { x: remembered.x, y: remembered.y }
          : getCascadedPosition(cascadeIndex, width, height)
        const canMaximize = chrome.maximizable
        const rememberedForChrome =
          remembered && !canMaximize && remembered.maximized ? { ...remembered, maximized: false } : remembered
        const defaultMaximized = canMaximize && openWindowsMaximized

        return (
          <WindowsWindow
            key={app.id}
            id={app.id}
            title={resolveDesktopItemTitle(app, tApps, locale)}
            width={width}
            height={height}
            defaultPosition={defaultPosition}
            defaultMaximized={defaultMaximized}
            rememberedBounds={rememberedForChrome}
            chrome={chrome}
            onClose={() => closeWindow(app.id)}
            onMinimize={chrome.minimizable ? () => minimizeWindow(app.id) : undefined}
            onBoundsChange={(bounds) => updateWindowBounds(app.id, bounds)}
            minimized={app.minimized}
            isActive={app.active}
            zIndex={app.zIndex}
            onFocus={() => focusWindow(app.id)}
          >
            <App />
          </WindowsWindow>
        )
      })}
    </>
  )
}
