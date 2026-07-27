import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbPut, newId } from './db'
import { getCachedObjectUrl, isLiveObjectUrl, rememberObjectUrl, revokeObjectUrl } from './objectUrl'
import { extFromMimeOrName, makeThumbBlob, type ImageExt } from './images'

/** 设置 / boot 里存的稳定引用（非 blob:） */
export const IDB_WALLPAPER_PREFIX = 'idb-wp:'

export type WallpaperRecord = {
  id: string
  name?: string
  contentType: string
  size: number
  createdAt: number
  blob: Blob
  thumbBlob: Blob | null
}

const MAX_BYTES = 10 * 1024 * 1024
const MAX_WALLPAPERS = 40
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isWallpaperId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

export function wallpaperRef(id: string): string {
  return `${IDB_WALLPAPER_PREFIX}${id}`
}

export function parseWallpaperRef(src: string): string | null {
  if (!src.startsWith(IDB_WALLPAPER_PREFIX)) return null
  const id = src.slice(IDB_WALLPAPER_PREFIX.length)
  return isWallpaperId(id) ? id : null
}

export function isIdbWallpaperRef(src: unknown): src is string {
  return typeof src === 'string' && parseWallpaperRef(src) != null
}

function urlKey(id: string) {
  return `wallpaper:${id}`
}
function thumbKey(id: string) {
  return `wallpaper-thumb:${id}`
}

function contentTypeForExt(ext: ImageExt): string {
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

export function wallpaperObjectUrls(rec: WallpaperRecord): { url: string; thumbUrl: string } {
  const url = getCachedObjectUrl(urlKey(rec.id)) ?? rememberObjectUrl(urlKey(rec.id), rec.blob)
  const thumbSrc = rec.thumbBlob ?? rec.blob
  const thumbUrl =
    getCachedObjectUrl(thumbKey(rec.id)) ?? rememberObjectUrl(thumbKey(rec.id), thumbSrc)
  return { url, thumbUrl }
}

/** 将 idb-wp: / http(s) / 本会话有效 blob: 解析为可给 CSS/img 用的地址 */
export async function resolveMediaDisplayUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null
  // 刷新后残留的 blob: 字符串已失效，不能当持久引用
  if (src.startsWith('blob:')) return isLiveObjectUrl(src) ? src : null
  if (src.startsWith('data:image/')) return src
  if (src.startsWith('http://') || src.startsWith('https://')) return src

  const id = parseWallpaperRef(src)
  if (!id) return null
  const cached = getCachedObjectUrl(urlKey(id))
  if (cached) return cached
  const rec = await idbGet<WallpaperRecord>(IDB_STORES.wallpapers, id)
  if (!rec?.blob) return null
  return rememberObjectUrl(urlKey(id), rec.blob)
}

export async function resolveMediaThumbUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null
  if (src.startsWith('blob:')) return isLiveObjectUrl(src) ? src : null
  if (src.startsWith('data:image/') || src.startsWith('http')) return src
  const id = parseWallpaperRef(src)
  if (!id) return null
  const cached = getCachedObjectUrl(thumbKey(id))
  if (cached) return cached
  const rec = await idbGet<WallpaperRecord>(IDB_STORES.wallpapers, id)
  if (!rec) return null
  const thumb = rec.thumbBlob ?? rec.blob
  return rememberObjectUrl(thumbKey(id), thumb)
}

async function saveWallpaperBlob(input: {
  blob: Blob
  name?: string
  contentType?: string | null
  nameHint?: string
}): Promise<WallpaperRecord> {
  if (input.blob.size === 0) throw new Error('图片为空')
  if (input.blob.size > MAX_BYTES) throw new Error('图片请小于 10MB')

  const all = await idbGetAll<WallpaperRecord>(IDB_STORES.wallpapers)
  if (all.length >= MAX_WALLPAPERS) throw new Error(`壁纸数量已达上限（${MAX_WALLPAPERS}）`)

  const ext = extFromMimeOrName(input.contentType ?? input.blob.type, input.nameHint || input.name || 'wp')
  const typed =
    input.blob.type && input.blob.type.startsWith('image/')
      ? input.blob
      : new Blob([input.blob], { type: contentTypeForExt(ext) })

  const id = newId()
  const thumbBlob = await makeThumbBlob(typed)
  const rec: WallpaperRecord = {
    id,
    name: input.name,
    contentType: typed.type || contentTypeForExt(ext),
    size: typed.size,
    createdAt: Date.now(),
    blob: typed,
    thumbBlob,
  }
  await idbPut(IDB_STORES.wallpapers, rec)
  rememberObjectUrl(urlKey(id), rec.blob)
  rememberObjectUrl(thumbKey(id), thumbBlob ?? rec.blob)
  return rec
}

export async function saveWallpaperFromFile(file: File, name?: string): Promise<WallpaperRecord> {
  if (!(file instanceof File) || file.size === 0) throw new Error('请选择图片文件')
  if (!file.type.startsWith('image/')) throw new Error('仅支持图片文件')
  return saveWallpaperBlob({
    blob: file,
    name: name || file.name.replace(/\.[^.]+$/, '') || '上传壁纸',
    contentType: file.type,
    nameHint: file.name,
  })
}

export async function saveWallpaperFromRemote(input: {
  blob: Blob
  contentType?: string | null
  name?: string
  nameHint?: string
}): Promise<WallpaperRecord> {
  return saveWallpaperBlob(input)
}

export async function getWallpaper(id: string): Promise<WallpaperRecord | null> {
  if (!isWallpaperId(id)) return null
  return (await idbGet<WallpaperRecord>(IDB_STORES.wallpapers, id)) ?? null
}

export async function deleteWallpaper(id: string): Promise<boolean> {
  if (!isWallpaperId(id)) return false
  const prev = await idbGet<WallpaperRecord>(IDB_STORES.wallpapers, id)
  if (!prev) return false
  await idbDelete(IDB_STORES.wallpapers, id)
  revokeObjectUrl(urlKey(id))
  revokeObjectUrl(thumbKey(id))
  return true
}
