import type { CSSProperties } from 'react'
import {
  isPublicWallpaperSrc,
  isVfsWallpaperPath,
} from '@/lib/wallpaper/resolve'
import type { WallpaperFitMode } from '@/lib/wallpaper/types'
import { isWallpaperFitMode } from '@/lib/wallpaper/types'

export type { WallpaperFitMode } from '@/lib/wallpaper/types'
export { WALLPAPER_FIT_MODES, isWallpaperFitMode } from '@/lib/wallpaper/types'
export { isPublicWallpaperSrc, isVfsWallpaperPath } from '@/lib/wallpaper/resolve'

export type WallpaperId =
  | 'classic-teal'
  | 'bliss-hill'
  | 'clouds'
  | 'midnight'
  | 'desert'
  | 'lavender'
  | 'matrix'
  | 'solid-teal'
  | 'solid-navy'
  | 'solid-olive'
  | 'custom'

export interface WallpaperPreset {
  id: Exclude<WallpaperId, 'custom'>
  /** 中文名称（设置页展示） */
  name: string
  /** 缩略图背景 */
  preview: string
  /** 桌面完整背景（CSS background） */
  background: string
}

/** 默认壁纸：当前经典青绿渐变（系统内置 CSS，不进 VFS） */
export const DEFAULT_WALLPAPER_ID: WallpaperId = 'classic-teal'
export const CUSTOM_WALLPAPER_ID: WallpaperId = 'custom'
export const DEFAULT_WALLPAPER_FIT: WallpaperFitMode = 'cover'

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'classic-teal',
    name: '经典青绿',
    preview:
      'radial-gradient(ellipse 80% 50% at 70% 20%, rgba(255,220,140,0.35), transparent 55%), linear-gradient(165deg, #3a8f8c, #2a6b69)',
    background:
      'radial-gradient(ellipse 80% 50% at 70% 20%, var(--desktop-bg-glow), transparent 55%), radial-gradient(ellipse 60% 40% at 15% 80%, var(--desktop-pattern), transparent 50%), linear-gradient(165deg, var(--desktop-bg), var(--desktop-bg-deep))',
  },
  {
    id: 'bliss-hill',
    name: '山丘晴空',
    preview: 'linear-gradient(180deg, #5BA3E0 0%, #87CEEB 42%, #7CB342 42%, #558B2F 100%)',
    background:
      'linear-gradient(180deg, #4a9ad4 0%, #7ec8ef 38%, #a8d4a0 38%, #6faa45 55%, #4e7c2e 100%)',
  },
  {
    id: 'clouds',
    name: '蓝天白云',
    preview:
      'radial-gradient(ellipse 40% 20% at 20% 30%, #fff 0%, transparent 70%), radial-gradient(ellipse 50% 25% at 70% 40%, #fff 0%, transparent 70%), linear-gradient(180deg, #4a90d9, #87b8e8)',
    background:
      'radial-gradient(ellipse 35% 18% at 15% 28%, rgba(255,255,255,0.95) 0%, transparent 70%), radial-gradient(ellipse 45% 22% at 55% 35%, rgba(255,255,255,0.9) 0%, transparent 70%), radial-gradient(ellipse 30% 15% at 80% 22%, rgba(255,255,255,0.85) 0%, transparent 70%), linear-gradient(180deg, #3d7ec9 0%, #6aa3e0 45%, #9bc4ef 100%)',
  },
  {
    id: 'midnight',
    name: '午夜星空',
    preview:
      'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px), linear-gradient(165deg, #0b1026, #1a1040)',
    background:
      'radial-gradient(1.5px 1.5px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 28% 42%, #cde, transparent), radial-gradient(1.5px 1.5px at 48% 22%, #fff, transparent), radial-gradient(1px 1px at 66% 58%, #def, transparent), radial-gradient(1.5px 1.5px at 82% 30%, #fff, transparent), radial-gradient(1px 1px at 90% 72%, #abc, transparent), linear-gradient(165deg, #070b1a 0%, #12103a 50%, #1a0f2e 100%)',
  },
  {
    id: 'desert',
    name: '沙漠黄昏',
    preview: 'linear-gradient(180deg, #f4a261 0%, #e76f51 40%, #c44536 70%, #6d2c1f 100%)',
    background:
      'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,220,160,0.55), transparent 60%), linear-gradient(180deg, #f0a05a 0%, #e07a45 35%, #c45a3a 65%, #7a331f 100%)',
  },
  {
    id: 'lavender',
    name: '淡紫薄雾',
    preview: 'linear-gradient(145deg, #c3aed6, #8675a9 50%, #5c4b7a)',
    background:
      'radial-gradient(ellipse 70% 50% at 80% 10%, rgba(255,255,255,0.25), transparent 55%), linear-gradient(145deg, #b8a0d0 0%, #8b74b0 45%, #5a4878 100%)',
  },
  {
    id: 'matrix',
    name: '终端矩阵',
    preview:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.08) 2px, rgba(0,255,100,0.08) 4px), #031a0a',
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,120,0.06) 3px, rgba(0,255,120,0.06) 6px), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,180,80,0.2), transparent 60%), linear-gradient(180deg, #021208, #032010)',
  },
  {
    id: 'solid-teal',
    name: '纯色青绿',
    preview: '#008080',
    background: '#008080',
  },
  {
    id: 'solid-navy',
    name: '纯色海军蓝',
    preview: '#000080',
    background: '#000080',
  },
  {
    id: 'solid-olive',
    name: '纯色橄榄',
    preview: '#808000',
    background: '#808000',
  },
]

const wallpaperMap = new Map<string, WallpaperPreset>(WALLPAPERS.map((w) => [w.id, w]))

export function getWallpaper(id: WallpaperId | string | undefined): WallpaperPreset {
  if (id === CUSTOM_WALLPAPER_ID) {
    return wallpaperMap.get(DEFAULT_WALLPAPER_ID)!
  }
  return wallpaperMap.get(id ?? '') ?? wallpaperMap.get(DEFAULT_WALLPAPER_ID)!
}

/**
 * 自定义壁纸引用：VFS `/Wallpapers/…`、public `/wallpapers/…`、http(s)。
 */
export function isValidCustomWallpaperSrc(src: unknown): src is string {
  if (typeof src !== 'string' || !src) return false
  if (isVfsWallpaperPath(src)) return true
  if (isPublicWallpaperSrc(src)) return true
  try {
    const u = new URL(src)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** 可直接用于 CSS 的壁纸地址（blob / http(s) / data / public） */
export function isDesktopWallpaperDisplaySrc(src: unknown): src is string {
  if (typeof src !== 'string' || !src) return false
  if (src.startsWith('blob:')) return true
  if (src.startsWith('data:image/')) return true
  if (isPublicWallpaperSrc(src)) return true
  try {
    const u = new URL(src)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function fitToBackgroundProps(fit: WallpaperFitMode): Pick<
  CSSProperties,
  'backgroundSize' | 'backgroundPosition' | 'backgroundRepeat'
> {
  switch (fit) {
    case 'tile':
      return {
        backgroundSize: 'auto',
        backgroundPosition: 'left top',
        backgroundRepeat: 'repeat',
      }
    case 'center':
      return {
        backgroundSize: 'auto',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    case 'stretch':
      return {
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    case 'cover':
    default:
      return {
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
  }
}

/** SSR / hydrate 首帧共用占位，避免 mismatch */
export const DESKTOP_BG_PLACEHOLDER_STYLE: CSSProperties = {
  backgroundColor: '#1a2a29',
}

/**
 * 解析桌面背景样式。
 * customSrc 应为已解析的可展示地址（blob:/http:/public），不要传 VFS 路径。
 */
export function resolveDesktopBackgroundStyle(
  wallpaperId: WallpaperId | string | undefined,
  customSrc: Nullable<string> | undefined,
  fit: WallpaperFitMode = DEFAULT_WALLPAPER_FIT,
): CSSProperties {
  const safeFit = isWallpaperFitMode(fit) ? fit : DEFAULT_WALLPAPER_FIT
  if (wallpaperId === CUSTOM_WALLPAPER_ID && customSrc && isDesktopWallpaperDisplaySrc(customSrc)) {
    return {
      backgroundColor: '#1a1a1a',
      backgroundImage: `url(${JSON.stringify(customSrc)})`,
      ...fitToBackgroundProps(safeFit),
    }
  }
  return {
    backgroundImage: 'none',
    background: getWallpaper(wallpaperId).background,
  }
}

export function isWallpaperId(id: unknown): id is WallpaperId {
  if (typeof id !== 'string') return false
  if (id === CUSTOM_WALLPAPER_ID) return true
  return wallpaperMap.has(id)
}

export function getWallpaperLabel(
  wallpaperId: WallpaperId,
  hasCustom: boolean,
  t: (key: string) => string,
): string {
  if (wallpaperId === CUSTOM_WALLPAPER_ID) {
    return hasCustom ? t('custom') : t('customEmpty')
  }
  return t(wallpaperId)
}
