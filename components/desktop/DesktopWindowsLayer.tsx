'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { WindowsWindow } from './WindowsWindow'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { DEFAULT_WINDOW_CHROME } from '@/config/desktop'
import { getCascadedPosition } from '@/lib/desktop'
import { getDesktopWindow, resolveDesktopItemTitle } from '@/lib/desktop/window'

/**
 * 已打开窗口层：自行订阅 window/desktop 合并视图，与图标层解耦。
 */
export function DesktopWindowsLayer() {
  const tApps = useTranslations('apps')
  const apps = useDesktopApps()
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
            .sort((a, b) => a.openOrder - b.openOrder || a.zIndex - b.zIndex)
        : [],
    [hasHydrated, apps],
  )

  const hasVisibleWindow = useMemo(
    () => hasHydrated && apps.some((app) => app.isOpen && !app.minimized),
    [hasHydrated, apps],
  )

  return (
    <>
      {hasVisibleWindow && (
        <div className='absolute inset-0 z-[100] bg-desktop-overlay pointer-events-none' aria-hidden />
      )}
      {openApps.map((app) => {
        if (!app.app) return null
        const App = app.app
        const deskWin = getDesktopWindow(app.id)
        const chrome = deskWin?.chrome ?? app.chrome ?? DEFAULT_WINDOW_CHROME
        const remembered = app.bounds
        // 有记忆则用记忆尺寸；否则才用定义里的默认宽高
        const width = remembered?.width ?? app.width ?? 400
        const height = remembered?.height ?? app.height ?? 320
        const cascadeIndex = openApps.filter((item) => item.zIndex < app.zIndex).length
        const defaultPosition = remembered
          ? { x: remembered.x, y: remembered.y }
          : getCascadedPosition(cascadeIndex, width, height)
        const canMaximize = chrome.maximizable
        const rememberedForChrome =
          remembered && !canMaximize && remembered.maximized
            ? { ...remembered, maximized: false }
            : remembered
        const defaultMaximized =
          canMaximize && (remembered != null ? remembered.maximized : openWindowsMaximized)

        return (
          <WindowsWindow
            key={app.id}
            id={app.id}
            title={resolveDesktopItemTitle(app, tApps)}
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
            <App embedded />
          </WindowsWindow>
        )
      })}
    </>
  )
}
