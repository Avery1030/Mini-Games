import { isValidCustomWallpaperSrc, isWallpaperId, type WallpaperId } from '@/config/wallpapers'
import { STORAGE_KEYS, appStorage, type WallpaperBootPersist } from '@/lib/storage'
import { isServer } from '@/lib/env'

export type WallpaperBootState = WallpaperBootPersist

function isBootableCustomUrl(src: string): boolean {
  // data:/blob: 过大或会话级，不适合同步 boot；idb-wp: 与 http(s) 可写
  return isValidCustomWallpaperSrc(src) && !src.startsWith('data:') && !src.startsWith('blob:')
}

/** 同步写入轻量标记，首屏在 settings 水合前避免闪回默认壁纸 */
export function writeWallpaperBoot(wallpaperId: WallpaperId, customUrl?: string | null): void {
  if (isServer) return
  const payload: WallpaperBootState = { wallpaperId }
  if (customUrl && isBootableCustomUrl(customUrl)) {
    payload.customUrl = customUrl
  }
  appStorage.setJson(STORAGE_KEYS.wallpaperBoot, payload)
}

export function readWallpaperBoot(): WallpaperBootState | null {
  if (isServer) return null
  const parsed = appStorage.getJson(STORAGE_KEYS.wallpaperBoot)
  if (!parsed || !isWallpaperId(parsed.wallpaperId)) return null
  const customUrl =
    typeof parsed.customUrl === 'string' && isBootableCustomUrl(parsed.customUrl) ? parsed.customUrl : undefined
  return { wallpaperId: parsed.wallpaperId, customUrl }
}

/** 水合完成前的占位色（无本地/CDN 可同步时用） */
export const WALLPAPER_BOOT_PLACEHOLDER = '#1a2a29'
