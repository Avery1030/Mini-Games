import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { IMAGE_VIEWER_DATA_DIR, IMAGE_VIEWER_INDEX_FILE } from './dir'
import { publicThumbUrl, thumbPath, writeThumbFromBuffer } from './thumb'

export type ImageExt = 'jpg' | 'png' | 'webp' | 'gif'

export type ImageMeta = {
  id: string
  title: string
  filename: string
  contentType: string
  size: number
  source: 'upload' | 'url'
  createdAt: number
  updatedAt: number
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/i
const MAX_TITLE = 80
const MAX_BYTES = 30 * 1024 * 1024
const MAX_IMAGES = 100

export function isImageId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

export function isImageFileName(name: unknown): name is string {
  return typeof name === 'string' && FILENAME_RE.test(name)
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

async function ensureDir() {
  await mkdir(IMAGE_VIEWER_DATA_DIR, { recursive: true })
}

function filePath(filename: string): string {
  if (!isImageFileName(filename)) throw new Error('无效文件名')
  const resolved = path.resolve(IMAGE_VIEWER_DATA_DIR, filename)
  const root = path.resolve(IMAGE_VIEWER_DATA_DIR) + path.sep
  if (!resolved.startsWith(root)) throw new Error('禁止访问')
  return resolved
}

async function readIndex(): Promise<ImageMeta[]> {
  await ensureDir()
  try {
    const raw = await readFile(IMAGE_VIEWER_INDEX_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ImageMeta => {
      if (!item || typeof item !== 'object') return false
      const m = item as ImageMeta
      return (
        isImageId(m.id) &&
        typeof m.title === 'string' &&
        isImageFileName(m.filename) &&
        typeof m.contentType === 'string' &&
        typeof m.size === 'number' &&
        (m.source === 'upload' || m.source === 'url') &&
        typeof m.createdAt === 'number' &&
        typeof m.updatedAt === 'number'
      )
    })
  } catch {
    return []
  }
}

async function writeIndex(items: ImageMeta[]) {
  await ensureDir()
  const tmp = `${IMAGE_VIEWER_INDEX_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(items, null, 2), 'utf8')
  await rename(tmp, IMAGE_VIEWER_INDEX_FILE)
}

export function publicUrl(filename: string): string {
  return `/api/image-viewer/file/${filename}`
}

export function toPublicImage(meta: ImageMeta) {
  return {
    ...meta,
    url: publicUrl(meta.filename),
    thumbUrl: publicThumbUrl(meta.id),
  }
}

export async function listImages(): Promise<ImageMeta[]> {
  const items = await readIndex()
  return [...items].sort((a, b) => b.createdAt - a.createdAt)
}

export async function getImage(id: string): Promise<ImageMeta | null> {
  if (!isImageId(id)) return null
  const index = await readIndex()
  return index.find((m) => m.id === id) ?? null
}

export async function readImageFile(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath(filename))
  } catch {
    return null
  }
}

export async function saveImageBuffer(input: {
  buffer: Buffer
  ext: ImageExt
  title?: string
  source: 'upload' | 'url'
}): Promise<ImageMeta> {
  if (input.buffer.length === 0) throw new Error('图片为空')
  if (input.buffer.length > MAX_BYTES) throw new Error('图片请小于 30MB')

  const index = await readIndex()
  if (index.length >= MAX_IMAGES) {
    throw new Error(`图片数量已达上限（${MAX_IMAGES}）`)
  }

  const now = Date.now()
  const id = randomUUID()
  const filename = `${id}.${input.ext === 'jpg' ? 'jpg' : input.ext}`
  const meta: ImageMeta = {
    id,
    title: sanitizeTitle(input.title, 'Untitled'),
    filename,
    contentType: contentTypeForExt(input.ext),
    size: input.buffer.length,
    source: input.source,
    createdAt: now,
    updatedAt: now,
  }

  await ensureDir()
  await writeFile(filePath(filename), input.buffer)
  try {
    await writeThumbFromBuffer(id, input.buffer)
  } catch (err) {
    console.error('[image-viewer] thumb', err)
    // 缩略图失败不阻断入库；首次请求 thumb 接口时再生成
  }
  await writeIndex([meta, ...index])
  return meta
}

export async function saveImageFromFile(file: File): Promise<ImageMeta> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('请选择图片文件')
  }
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    throw new Error('仅支持图片文件')
  }
  if (file.size > MAX_BYTES) throw new Error('图片请小于 30MB')

  const ext = extFromMimeOrName(file.type, file.name)
  const buffer = Buffer.from(await file.arrayBuffer())
  return saveImageBuffer({
    buffer,
    ext,
    title: titleFromFileName(file.name),
    source: 'upload',
  })
}

export async function importImageFromUrl(rawUrl: string): Promise<ImageMeta> {
  const raw = rawUrl.trim()
  if (!raw) throw new Error('缺少 url')

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    throw new Error('url 无效')
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new Error('仅支持 http(s)')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'mini-windows-desktop-image-viewer/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!upstream.ok) throw new Error(`拉取失败 (${upstream.status})`)

    const ct = upstream.headers.get('content-type')
    if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
      throw new Error('目标不是图片')
    }

    const buffer = Buffer.from(await upstream.arrayBuffer())
    const ext = extFromMimeOrName(ct, target.pathname)
    const nameGuess = decodeURIComponent(path.basename(target.pathname) || '').replace(/[?#].*$/, '') || 'image'
    return saveImageBuffer({
      buffer,
      ext,
      title: titleFromFileName(nameGuess),
      source: 'url',
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('拉取超时')
    throw err instanceof Error ? err : new Error('导入失败')
  } finally {
    clearTimeout(timer)
  }
}

export async function deleteImage(id: string): Promise<boolean> {
  if (!isImageId(id)) return false
  const index = await readIndex()
  const meta = index.find((m) => m.id === id)
  if (!meta) return false

  await writeIndex(index.filter((m) => m.id !== id))
  try {
    await unlink(filePath(meta.filename))
  } catch {
    // 索引已更新；文件缺失时忽略
  }
  try {
    await unlink(thumbPath(id))
  } catch {
    // ignore
  }
  return true
}

export async function deleteImages(ids: string[]): Promise<number> {
  let n = 0
  for (const id of ids) {
    if (await deleteImage(id)) n += 1
  }
  return n
}
