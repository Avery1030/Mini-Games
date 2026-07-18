import {
  CUSTOM_WALLPAPER_ID,
  isWallpaperId,
  type WallpaperId,
} from '@/config/wallpapers'

const BOOT_KEY = 'desktop-wallpaper-boot'

export type WallpaperBootState = {
  wallpaperId: WallpaperId
  /** 仅存 http(s) CDN 地址，用于首屏同步恢复自定义壁纸 */
  customUrl?: string
}

function isHttpUrl(src: string): boolean {
  try {
    const u = new URL(src)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** 同步写入轻量标记，首屏在 IndexedDB 水合前避免闪回默认壁纸 */
export function writeWallpaperBoot(
  wallpaperId: WallpaperId,
  customUrl?: string | null,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: WallpaperBootState = { wallpaperId }
    if (customUrl && isHttpUrl(customUrl)) {
      payload.customUrl = customUrl
    }
    localStorage.setItem(BOOT_KEY, JSON.stringify(payload))
  } catch {
    // quota / private mode
  }
}

export function readWallpaperBoot(): WallpaperBootState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(BOOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { wallpaperId?: unknown; customUrl?: unknown }
    if (!isWallpaperId(parsed.wallpaperId)) return null
    const customUrl =
      typeof parsed.customUrl === 'string' && isHttpUrl(parsed.customUrl)
        ? parsed.customUrl
        : undefined
    return { wallpaperId: parsed.wallpaperId, customUrl }
  } catch {
    return null
  }
}

/** 水合完成前的占位色（无 CDN 可同步时用） */
export const WALLPAPER_BOOT_PLACEHOLDER = '#1a2a29'
