import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/store/settings'

/** 外观页：一次浅比较订阅相关字段 */
export function useAppearanceSettings() {
  return useSettingsStore(
    useShallow((s) => ({
      showIconLabels: s.showIconLabels,
      iconSize: s.iconSize,
      uiScale: s.uiScale,
      openWindowsMaximized: s.openWindowsMaximized,
      screensaverEnabled: s.screensaverEnabled,
      screensaverIdleMinutes: s.screensaverIdleMinutes,
    })),
  )
}

/** 任务栏设置页 */
export function useTaskbarSettings() {
  return useSettingsStore(
    useShallow((s) => ({
      showTaskbarClock: s.showTaskbarClock,
      clockFormat: s.clockFormat,
    })),
  )
}

/** 显示页壁纸相关状态（不含 action） */
export function useWallpaperSettings() {
  return useSettingsStore(
    useShallow((s) => ({
      wallpaperId: s.wallpaperId,
      wallpaperPath: s.wallpaperPath,
      wallpaperFit: s.wallpaperFit,
      wallpaper3dEnabled: s.wallpaper3dEnabled,
      wallpaper3dPath: s.wallpaper3dPath,
    })),
  )
}
