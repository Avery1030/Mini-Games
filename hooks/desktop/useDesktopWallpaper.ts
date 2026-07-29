'use client'

import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import {
  resolveDesktopBackgroundStyle,
  DESKTOP_BG_PLACEHOLDER_STYLE,
  CUSTOM_WALLPAPER_ID,
  isDesktopWallpaperDisplaySrc,
  DEFAULT_WALLPAPER_FIT,
} from '@/config/wallpapers'
import { readWallpaperBoot, resolveWallpaperDisplayUrl } from '@/lib/wallpaper'
import { useSettingsStore } from '@/store/settings'

function isSyncDisplaySrc(src: string): boolean {
  return isDesktopWallpaperDisplaySrc(src) && !src.startsWith('blob:')
}

/**
 * 桌面壁纸样式：首帧占位 → boot 同步恢复 → settings 水合后跟配置。
 * VFS 壁纸异步解析为 blob URL。
 */
export function useDesktopWallpaper(): CSSProperties {
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const wallpaperPath = useSettingsStore((s) => s.wallpaperPath)
  const wallpaperFit = useSettingsStore((s) => s.wallpaperFit)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const [desktopBgStyle, setDesktopBgStyle] = useState<CSSProperties>(DESKTOP_BG_PLACEHOLDER_STYLE)

  useLayoutEffect(() => {
    const boot = readWallpaperBoot()
    if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.wallpaperPath) {
      if (boot.wallpaperPath.startsWith('/Wallpapers/')) {
        return
      }
      if (isSyncDisplaySrc(boot.wallpaperPath)) {
        setDesktopBgStyle(
          resolveDesktopBackgroundStyle(
            CUSTOM_WALLPAPER_ID,
            boot.wallpaperPath,
            boot.wallpaperFit ?? DEFAULT_WALLPAPER_FIT,
          ),
        )
      }
      return
    }
    if (boot?.wallpaperId && boot.wallpaperId !== CUSTOM_WALLPAPER_ID) {
      setDesktopBgStyle(resolveDesktopBackgroundStyle(boot.wallpaperId, null, boot.wallpaperFit))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!settingsHydrated) {
        const boot = readWallpaperBoot()
        if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.wallpaperPath?.startsWith('/Wallpapers/')) {
          const resolved = await resolveWallpaperDisplayUrl(boot.wallpaperPath)
          if (!cancelled && resolved) {
            setDesktopBgStyle(
              resolveDesktopBackgroundStyle(
                CUSTOM_WALLPAPER_ID,
                resolved,
                boot.wallpaperFit ?? DEFAULT_WALLPAPER_FIT,
              ),
            )
          }
        }
        return
      }
      if (wallpaperId === CUSTOM_WALLPAPER_ID && wallpaperPath) {
        const resolved =
          (await resolveWallpaperDisplayUrl(wallpaperPath)) ??
          (wallpaperPath.startsWith('http') || wallpaperPath.startsWith('/wallpapers/')
            ? wallpaperPath
            : null)
        if (!cancelled) {
          setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, resolved, wallpaperFit))
        }
        return
      }
      if (!cancelled) {
        setDesktopBgStyle(resolveDesktopBackgroundStyle(wallpaperId, null, wallpaperFit))
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [settingsHydrated, wallpaperId, wallpaperPath, wallpaperFit])

  return desktopBgStyle
}
