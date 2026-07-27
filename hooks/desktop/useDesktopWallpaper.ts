'use client'

import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import {
  resolveDesktopBackgroundStyle,
  DESKTOP_BG_PLACEHOLDER_STYLE,
  CUSTOM_WALLPAPER_ID,
} from '@/config/wallpapers'
import { resolveMediaDisplayUrl } from '@/lib/idb'
import { readWallpaperBoot } from '@/lib/wallpaper'
import { useSettingsStore } from '@/store/settings'

/**
 * 桌面壁纸样式：首帧用占位，boot 同步恢复，settings 水合后再跟设置。
 * IndexedDB 壁纸异步解析为 blob URL。
 */
export function useDesktopWallpaper(): CSSProperties {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const [desktopBgStyle, setDesktopBgStyle] = useState<CSSProperties>(DESKTOP_BG_PLACEHOLDER_STYLE)

  useLayoutEffect(() => {
    const boot = readWallpaperBoot()
    if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.customUrl) {
      if (boot.customUrl.startsWith('idb-wp:')) {
        // 异步解析，先占位
        return
      }
      setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, boot.customUrl))
      return
    }
    if (boot?.wallpaperId && boot.wallpaperId !== CUSTOM_WALLPAPER_ID) {
      setDesktopBgStyle(resolveDesktopBackgroundStyle(boot.wallpaperId, null))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!settingsHydrated) {
        const boot = readWallpaperBoot()
        if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.customUrl?.startsWith('idb-wp:')) {
          const resolved = await resolveMediaDisplayUrl(boot.customUrl)
          if (!cancelled && resolved) {
            setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, resolved))
          }
        }
        return
      }
      const gallery = useSettingsStore.getState().wallpaperGallery
      const ref =
        customWallpaperUrl &&
        (gallery.find((g) => g.url === customWallpaperUrl || g.thumbUrl === customWallpaperUrl)?.url ??
          customWallpaperUrl)
      if (wallpaperId === CUSTOM_WALLPAPER_ID && ref) {
        const resolved = (await resolveMediaDisplayUrl(ref)) ?? (ref.startsWith('http') ? ref : null)
        if (!cancelled) {
          setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, resolved))
        }
        return
      }
      if (!cancelled) {
        setDesktopBgStyle(resolveDesktopBackgroundStyle(wallpaperId, null))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [settingsHydrated, wallpaperId, customWallpaperUrl])

  return desktopBgStyle
}
