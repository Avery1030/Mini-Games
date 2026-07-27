import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbPut, newId } from './db'
import { getCachedObjectUrl, rememberObjectUrl, revokeObjectUrl } from './objectUrl'

export type DrawingRecord = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** PNG blob；无画布时为空 */
  png: Blob | null
}

const MAX_TITLE = 80
const MAX_PNG_BYTES = 10 * 1024 * 1024
const MAX_DRAWINGS = 80
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isDrawingId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, MAX_TITLE)
}

function cacheKey(id: string) {
  return `drawing:${id}`
}

/** 解析 data URL 或纯 base64 为 PNG Blob */
export async function parsePngBase64(raw: unknown): Promise<Blob> {
  if (typeof raw !== 'string' || !raw) throw new Error('Image data required')
  let b64 = raw
  const m = /^data:image\/png;base64,(.+)$/i.exec(raw)
  if (m) b64 = m[1]!
  else if (raw.startsWith('data:')) throw new Error('Only PNG data URL is supported')

  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  if (bytes.length === 0) throw new Error('Empty image')
  if (bytes.length > MAX_PNG_BYTES) throw new Error('Image too large (max 10MB)')
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new Error('Invalid PNG')
  }
  return new Blob([bytes], { type: 'image/png' })
}

export function drawingObjectUrl(rec: DrawingRecord): string | null {
  if (!rec.png) return null
  const key = cacheKey(rec.id)
  return getCachedObjectUrl(key) ?? rememberObjectUrl(key, rec.png)
}

export async function listDrawings(): Promise<DrawingRecord[]> {
  const all = await idbGetAll<DrawingRecord>(IDB_STORES.drawings)
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDrawing(id: string): Promise<DrawingRecord | null> {
  if (!isDrawingId(id)) return null
  return (await idbGet<DrawingRecord>(IDB_STORES.drawings, id)) ?? null
}

export async function createDrawing(input?: {
  title?: string
  imageBase64?: string
}): Promise<DrawingRecord> {
  const all = await idbGetAll<DrawingRecord>(IDB_STORES.drawings)
  if (all.length >= MAX_DRAWINGS) throw new Error(`Drawing limit reached (${MAX_DRAWINGS})`)

  const now = Date.now()
  const id = newId()
  const png = input?.imageBase64 ? await parsePngBase64(input.imageBase64) : null
  const rec: DrawingRecord = {
    id,
    title: sanitizeTitle(input?.title),
    createdAt: now,
    updatedAt: now,
    png,
  }
  await idbPut(IDB_STORES.drawings, rec)
  if (png) rememberObjectUrl(cacheKey(id), png)
  return rec
}

export async function updateDrawing(
  id: string,
  patch: { title?: string; imageBase64?: string },
): Promise<DrawingRecord | null> {
  if (!isDrawingId(id)) return null
  const prev = await idbGet<DrawingRecord>(IDB_STORES.drawings, id)
  if (!prev) return null

  let png = prev.png
  if (patch.imageBase64) {
    png = await parsePngBase64(patch.imageBase64)
    rememberObjectUrl(cacheKey(id), png)
  }
  const next: DrawingRecord = {
    ...prev,
    title: patch.title !== undefined ? sanitizeTitle(patch.title, prev.title) : prev.title,
    updatedAt: Date.now(),
    png,
  }
  await idbPut(IDB_STORES.drawings, next)
  return next
}

export async function deleteDrawing(id: string): Promise<boolean> {
  if (!isDrawingId(id)) return false
  const prev = await idbGet<DrawingRecord>(IDB_STORES.drawings, id)
  if (!prev) return false
  await idbDelete(IDB_STORES.drawings, id)
  revokeObjectUrl(cacheKey(id))
  return true
}
