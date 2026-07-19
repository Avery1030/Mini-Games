'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { WindowsWindow } from './WindowsWindow'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { getCascadedPosition } from '@/lib/desktop'

/**
 * 已打开窗口层：自行订阅 window/desktop 合并视图，与图标层解耦。
 */
export function DesktopWindowsLayer() {
  const t = useTranslations()
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const focusWindow = useWindowStore((s) => s.focusWindow)
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
        const width = app.width ?? 400
        const height = app.height ?? 320
        const cascadeIndex = openApps.filter((item) => item.zIndex < app.zIndex).length
        return (
          <WindowsWindow
            key={app.id}
            id={app.id}
            title={t(`apps.${app.id}`)}
            width={width}
            height={height}
            defaultPosition={getCascadedPosition(cascadeIndex, width, height)}
            defaultMaximized={openWindowsMaximized}
            onClose={() => closeWindow(app.id)}
            onMinimize={() => minimizeWindow(app.id)}
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
