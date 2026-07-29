import { isValidCustomWallpaperSrc, isWallpaperId, type WallpaperId } from '@/config/wallpapers'
import { isWallpaperFitMode, type WallpaperFitMode } from '@/lib/wallpaper/types'
import { DEFAULT_WALLPAPER_FIT } from '@/config/wallpapers'
import { STORAGE_KEYS, appStorage, type WallpaperBootPersist } from '@/lib/storage'
import { isServer } from '@/lib/env'
import { isVfsWallpaperPath, isPublicWallpaperSrc } from '@/lib/wallpaper/resolve'

export type WallpaperBootState = WallpaperBootPersist

function isBootablePath(src: string): boolean {
  if (isVfsWallpaperPath(src) || isPublicWallpaperSrc(src)) return true
  if (!isValidCustomWallpaperSrc(src)) return false
  return !src.startsWith('data:') && !src.startsWith('blob:')
}

/** 同步写入轻量标记，首屏在 settings 水合前避免闪回默认壁纸 */
export function writeWallpaperBoot(input: {
  wallpaperId: WallpaperId
  wallpaperPath?: string | null
  wallpaperFit?: WallpaperFitMode
  wallpaper3dEnabled?: boolean
  wallpaper3dPath?: string | null
}): void {
  if (isServer) return
  const payload: WallpaperBootState = {
    wallpaperId: input.wallpaperId,
    wallpaperFit: input.wallpaperFit && isWallpaperFitMode(input.wallpaperFit) ? input.wallpaperFit : DEFAULT_WALLPAPER_FIT,
    wallpaper3dEnabled: Boolean(input.wallpaper3dEnabled),
  }
  if (input.wallpaperPath && isBootablePath(input.wallpaperPath)) {
    payload.wallpaperPath = input.wallpaperPath
  }
  if (input.wallpaper3dPath && isVfsWallpaperPath(input.wallpaper3dPath)) {
    payload.wallpaper3dPath = input.wallpaper3dPath
  }
  appStorage.setJson(STORAGE_KEYS.wallpaperBoot, payload)
}

export function readWallpaperBoot(): WallpaperBootState | null {
  if (isServer) return null
  const parsed = appStorage.getJson(STORAGE_KEYS.wallpaperBoot)
  if (!parsed || !isWallpaperId(parsed.wallpaperId)) return null

  const wallpaperPath =
    typeof parsed.wallpaperPath === 'string' && isBootablePath(parsed.wallpaperPath)
      ? parsed.wallpaperPath
      : undefined

  const wallpaperFit = isWallpaperFitMode(parsed.wallpaperFit) ? parsed.wallpaperFit : DEFAULT_WALLPAPER_FIT
  const wallpaper3dEnabled = parsed.wallpaper3dEnabled === true
  const wallpaper3dPath =
    typeof parsed.wallpaper3dPath === 'string' && isVfsWallpaperPath(parsed.wallpaper3dPath)
      ? parsed.wallpaper3dPath
      : undefined

  return {
    wallpaperId: parsed.wallpaperId,
    wallpaperPath,
    wallpaperFit,
    wallpaper3dEnabled,
    wallpaper3dPath,
  }
}

/** 水合完成前的占位色（无本地/CDN 可同步时用） */
export const WALLPAPER_BOOT_PLACEHOLDER = '#1a2a29'
