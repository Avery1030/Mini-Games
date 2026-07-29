/** 用户壁纸在 VFS 中的根目录 */
export const WALLPAPERS_DIR = '/Wallpapers'

/** 3D GLB 壁纸子目录 */
export const WALLPAPERS_3D_DIR = '/Wallpapers/3d'

/** 系统内置壁纸（public 静态资源）前缀，不进 VFS */
export const PUBLIC_WALLPAPERS_PREFIX = '/wallpapers/'

/** 桌面图片填充模式 */
export type WallpaperFitMode = 'tile' | 'cover' | 'center' | 'stretch'

export const WALLPAPER_FIT_MODES: readonly WallpaperFitMode[] = [
  'tile',
  'cover',
  'center',
  'stretch',
] as const

export function isWallpaperFitMode(v: unknown): v is WallpaperFitMode {
  return typeof v === 'string' && (WALLPAPER_FIT_MODES as readonly string[]).includes(v)
}

export type WallpaperAssetKind = 'image' | 'model'

/** VFS 壁纸列表项（设置页预览用） */
export type WallpaperAsset = {
  id: string
  path: string
  name: string
  kind: WallpaperAssetKind
  mimeType?: string
  size: number
  createdAt: number
  updatedAt: number
}
