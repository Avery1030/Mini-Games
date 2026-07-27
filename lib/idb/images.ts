import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbPut, newId } from './db'
import { getCachedObjectUrl, rememberObjectUrl, revokeObjectUrl } from './objectUrl'

export type ImageExt = 'jpg' | 'png' | 'webp' | 'gif'

export type ImageRecord = {
  id: string
  title: string
  filename: string
  contentType: string
  size: number
  source: 'upload' | 'url'
  createdAt: number
  updatedAt: number
  blob: Blob
  thumbBlob: Blob | null
}

const MAX_TITLE = 80
const MAX_BYTES = 10 * 1024 * 1024
const MAX_IMAGES = 100
const THUMB_MAX_EDGE = 160
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isImageId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

export function contentTypeForExt(ext: ImageExt): string {
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

export function extFromMimeOrName(mime: string | null | undefined, nameOrUrl: string): ImageExt {
  const t = (mime || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  const lower = nameOrUrl.toLowerCase()
  if (lower.includes('.png')) return 'png'
  if (lower.includes('.webp')) return 'webp'
  if (lower.includes('.gif')) return 'gif'
  return 'jpg'
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, MAX_TITLE)
}

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim()
  return sanitizeTitle(base || 'Untitled')
}

function urlKey(id: string) {
  return `image:${id}`
}
function thumbKey(id: string) {
  return `image-thumb:${id}`
}

/** 浏览器内生成 JPEG 缩略图（最长边 160） */
export async function makeThumbBlob(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72)
    })
  } catch {
    return null
  }
}

export function imageObjectUrls(rec: ImageRecord): { url: string; thumbUrl: string } {
  const url = getCachedObjectUrl(urlKey(rec.id)) ?? rememberObjectUrl(urlKey(rec.id), rec.blob)
  const thumbSrc = rec.thumbBlob ?? rec.blob
  const thumbUrl =
    getCachedObjectUrl(thumbKey(rec.id)) ?? rememberObjectUrl(thumbKey(rec.id), thumbSrc)
  return { url, thumbUrl }
}

export async function listImages(): Promise<ImageRecord[]> {
  const all = await idbGetAll<ImageRecord>(IDB_STORES.images)
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function getImage(id: string): Promise<ImageRecord | null> {
  if (!isImageId(id)) return null
  return (await idbGet<ImageRecord>(IDB_STORES.images, id)) ?? null
}

async function saveImageBlob(input: {
  blob: Blob
  ext: ImageExt
  title?: string
  source: 'upload' | 'url'
}): Promise<ImageRecord> {
  if (input.blob.size === 0) throw new Error('图片为空')
  if (input.blob.size > MAX_BYTES) throw new Error('图片请小于 10MB')

  const all = await idbGetAll<ImageRecord>(IDB_STORES.images)
  if (all.length >= MAX_IMAGES) throw new Error(`图片数量已达上限（${MAX_IMAGES}）`)

  const now = Date.now()
  const id = newId()
  const filename = `${id}.${input.ext}`
  const thumbBlob = await makeThumbBlob(input.blob)
  const typedBlob =
    input.blob.type && input.blob.type.startsWith('image/')
      ? input.blob
      : new Blob([input.blob], { type: contentTypeForExt(input.ext) })

  const rec: ImageRecord = {
    id,
    title: sanitizeTitle(input.title, 'Untitled'),
    filename,
    contentType: typedBlob.type || contentTypeForExt(input.ext),
    size: typedBlob.size,
    source: input.source,
    createdAt: now,
    updatedAt: now,
    blob: typedBlob,
    thumbBlob,
  }
  await idbPut(IDB_STORES.images, rec)
  rememberObjectUrl(urlKey(id), rec.blob)
  rememberObjectUrl(thumbKey(id), thumbBlob ?? rec.blob)
  return rec
}

export async function saveImageFromFile(file: File): Promise<ImageRecord> {
  if (!(file instanceof File) || file.size === 0) throw new Error('请选择图片文件')
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    throw new Error('仅支持图片文件')
  }
  if (file.size > MAX_BYTES) throw new Error('图片请小于 10MB')
  const ext = extFromMimeOrName(file.type, file.name)
  return saveImageBlob({
    blob: file,
    ext,
    title: titleFromFileName(file.name),
    source: 'upload',
  })
}

export async function saveImageFromRemote(input: {
  blob: Blob
  contentType?: string | null
  nameHint?: string
}): Promise<ImageRecord> {
  const name = input.nameHint || 'image'
  const ext = extFromMimeOrName(input.contentType ?? input.blob.type, name)
  return saveImageBlob({
    blob: input.blob,
    ext,
    title: titleFromFileName(name),
    source: 'url',
  })
}

export async function deleteImage(id: string): Promise<boolean> {
  if (!isImageId(id)) return false
  const prev = await idbGet<ImageRecord>(IDB_STORES.images, id)
  if (!prev) return false
  await idbDelete(IDB_STORES.images, id)
  revokeObjectUrl(urlKey(id))
  revokeObjectUrl(thumbKey(id))
  return true
}
