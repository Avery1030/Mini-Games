import { getCachedObjectUrl, isLiveObjectUrl, rememberObjectUrl } from '@/lib/idb/objectUrl'
import { makeThumbBlob } from '@/lib/idb/imageUtils'
import { normalizePath, vfs } from '@/lib/vfs'
import { PUBLIC_WALLPAPERS_PREFIX, WALLPAPERS_DIR } from './types'

function cacheKey(path: string, kind: 'full' | 'thumb'): string {
  return `vfs-wp:${kind}:${path}`
}

/** 是否为 VFS 用户壁纸绝对路径 */
export function isVfsWallpaperPath(src: unknown): boolean {
  if (typeof src !== 'string' || !src.startsWith('/')) return false
  try {
    const n = normalizePath(src)
    return n.startsWith(`${WALLPAPERS_DIR}/`) && n !== `${WALLPAPERS_DIR}/3d`
  } catch {
    return false
  }
}

/** 是否为 public 静态壁纸路径 */
export function isPublicWallpaperSrc(src: unknown): boolean {
  return typeof src === 'string' && src.startsWith(PUBLIC_WALLPAPERS_PREFIX)
}

/**
 * 将壁纸引用解析为可给 CSS/img 使用的地址。
 * - VFS 路径 → 读内容生成 blob URL
 * - public `/wallpapers/…` → 原样返回
 * - http(s) / 本会话 live blob / data:image → 原样或校验后返回
 */
export async function resolveWallpaperDisplayUrl(
  src: string | null | undefined,
): Promise<string | null> {
  if (!src) return null

  if (src.startsWith('blob:')) return isLiveObjectUrl(src) ? src : null
  if (src.startsWith('data:image/')) return src
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  if (isPublicWallpaperSrc(src)) return src

  if (!isVfsWallpaperPath(src)) return null

  const cached = getCachedObjectUrl(cacheKey(src, 'full'))
  if (cached) return cached

  try {
    const { content, node } = await vfs.readFile(src)
    const mime = node.mimeType || 'application/octet-stream'
    const blob =
      typeof content === 'string' ? new Blob([content], { type: mime }) : new Blob([content], { type: mime })
    return rememberObjectUrl(cacheKey(src, 'full'), blob)
  } catch {
    return null
  }
}

/** 预览缩略图：图片生成 JPEG thumb；模型/其它回退到原图解析 */
export async function resolveWallpaperThumbUrl(
  src: string | null | undefined,
): Promise<string | null> {
  if (!src) return null
  if (isPublicWallpaperSrc(src) || src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  if (!isVfsWallpaperPath(src)) {
    return resolveWallpaperDisplayUrl(src)
  }

  const cached = getCachedObjectUrl(cacheKey(src, 'thumb'))
  if (cached) return cached

  const full = await resolveWallpaperDisplayUrl(src)
  if (!full) return null

  if (src.toLowerCase().endsWith('.glb') || src.toLowerCase().endsWith('.gltf')) {
    return full
  }

  try {
    const res = await fetch(full)
    const blob = await res.blob()
    const thumb = (await makeThumbBlob(blob)) ?? blob
    return rememberObjectUrl(cacheKey(src, 'thumb'), thumb)
  } catch {
    return full
  }
}
