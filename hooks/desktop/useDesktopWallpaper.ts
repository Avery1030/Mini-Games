'use client'

import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import {
  resolveDesktopBackgroundStyle,
  DESKTOP_BG_PLACEHOLDER_STYLE,
  CUSTOM_WALLPAPER_ID,
} from '@/config/wallpapers'
import { readWallpaperBoot } from '@/lib/wallpaper'
import { useSettingsStore } from '@/store/settings'

/**
 * 桌面壁纸样式：首帧用占位，boot 同步恢复，settings 水合后再跟设置。
 * 禁止在 render 里读 localStorage，避免 SSR hydrate mismatch。
 */
export function useDesktopWallpaper(): CSSProperties {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const [desktopBgStyle, setDesktopBgStyle] = useState<CSSProperties>(DESKTOP_BG_PLACEHOLDER_STYLE)

  useLayoutEffect(() => {
    const boot = readWallpaperBoot()
    const gallery = useSettingsStore.getState().wallpaperGallery
    if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.customUrl) {
      const full =
        gallery.find((g) => g.url === boot.customUrl || g.thumbUrl === boot.customUrl)?.url ?? boot.customUrl
      setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, full))
      return
    }
    if (boot?.wallpaperId && boot.wallpaperId !== CUSTOM_WALLPAPER_ID) {
      setDesktopBgStyle(resolveDesktopBackgroundStyle(boot.wallpaperId, null))
    }
  }, [])

  useEffect(() => {
    if (!settingsHydrated) return
    const gallery = useSettingsStore.getState().wallpaperGallery
    const full =
      customWallpaperUrl &&
      (gallery.find((g) => g.url === customWallpaperUrl || g.thumbUrl === customWallpaperUrl)?.url ??
        customWallpaperUrl)
    setDesktopBgStyle(resolveDesktopBackgroundStyle(wallpaperId, full))
  }, [settingsHydrated, wallpaperId, customWallpaperUrl])

  return desktopBgStyle
}
