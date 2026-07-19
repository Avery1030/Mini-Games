import { mkdir, readFile, rename, unlink, writeFile, access } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { DRAWINGS_DATA_DIR, DRAWINGS_INDEX_FILE } from './dir'

export type DrawingMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type DrawingRecord = DrawingMeta & {
  /** 是否已有 png 文件 */
  hasImage: boolean
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_TITLE = 80
const MAX_PNG_BYTES = 4 * 1024 * 1024
const MAX_DRAWINGS = 80

export function isDrawingId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

export function drawingFileName(id: string): string {
  if (!isDrawingId(id)) throw new Error('Invalid drawing id')
  return `${id}.png`
}

export function drawingPath(id: string): string {
  return path.join(DRAWINGS_DATA_DIR, drawingFileName(id))
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, MAX_TITLE)
}

/** 解析 data URL 或纯 base64 为 PNG Buffer */
export function parsePngBase64(raw: unknown): Buffer {
  if (typeof raw !== 'string' || !raw) {
    throw new Error('Image data required')
  }
  let b64 = raw
  const m = /^data:image\/png;base64,(.+)$/i.exec(raw)
  if (m) b64 = m[1]!
  else if (raw.startsWith('data:')) {
    throw new Error('Only PNG data URL is supported')
  }
  const buf = Buffer.from(b64, 'base64')
  if (buf.length === 0) throw new Error('Empty image')
  if (buf.length > MAX_PNG_BYTES) throw new Error('Image too large (max 4MB)')
  // PNG signature
  if (
    buf.length < 8 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    throw new Error('Invalid PNG')
  }
  return buf
}

async function ensureDir() {
  await mkdir(DRAWINGS_DATA_DIR, { recursive: true })
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function readIndex(): Promise<DrawingMeta[]> {
  await ensureDir()
  try {
    const raw = await readFile(DRAWINGS_INDEX_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is DrawingMeta =>
        !!item &&
        typeof item === 'object' &&
        isDrawingId((item as DrawingMeta).id) &&
        typeof (item as DrawingMeta).title === 'string' &&
        typeof (item as DrawingMeta).createdAt === 'number' &&
        typeof (item as DrawingMeta).updatedAt === 'number',
    )
  } catch {
    return []
  }
}

async function writeIndex(items: DrawingMeta[]) {
  await ensureDir()
  const tmp = `${DRAWINGS_INDEX_FILE}.${randomUUID()}.tmp`
  await writeFile(tmp, JSON.stringify(items, null, 2), 'utf8')
  await rename(tmp, DRAWINGS_INDEX_FILE)
}

async function toRecord(meta: DrawingMeta): Promise<DrawingRecord> {
  return {
    ...meta,
    hasImage: await fileExists(drawingPath(meta.id)),
  }
}

export async function listDrawings(): Promise<DrawingRecord[]> {
  const items = await readIndex()
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt)
  return Promise.all(sorted.map(toRecord))
}

export async function getDrawing(id: string): Promise<DrawingRecord | null> {
  if (!isDrawingId(id)) return null
  const index = await readIndex()
  const meta = index.find((d) => d.id === id)
  if (!meta) return null
  return toRecord(meta)
}

export async function readDrawingPng(id: string): Promise<Buffer | null> {
  if (!isDrawingId(id)) return null
  try {
    return await readFile(drawingPath(id))
  } catch {
    return null
  }
}

export async function createDrawing(input?: {
  title?: string
  imageBase64?: string
}): Promise<DrawingRecord> {
  const index = await readIndex()
  if (index.length >= MAX_DRAWINGS) {
    throw new Error(`Drawing limit reached (${MAX_DRAWINGS})`)
  }

  const now = Date.now()
  const id = randomUUID()
  const title = sanitizeTitle(input?.title)
  const meta: DrawingMeta = { id, title, createdAt: now, updatedAt: now }

  await ensureDir()
  if (input?.imageBase64) {
    const png = parsePngBase64(input.imageBase64)
    await writeFile(drawingPath(id), png)
  }
  await writeIndex([meta, ...index])
  return toRecord(meta)
}

export async function updateDrawing(
  id: string,
  patch: { title?: string; imageBase64?: string },
): Promise<DrawingRecord | null> {
  if (!isDrawingId(id)) return null
  const index = await readIndex()
  const idx = index.findIndex((d) => d.id === id)
  if (idx < 0) return null

  const prev = index[idx]!
  if (patch.imageBase64) {
    const png = parsePngBase64(patch.imageBase64)
    await writeFile(drawingPath(id), png)
  }
  const title = patch.title !== undefined ? sanitizeTitle(patch.title, prev.title) : prev.title
  const meta: DrawingMeta = { ...prev, title, updatedAt: Date.now() }
  const next = [...index]
  next[idx] = meta
  await writeIndex(next)
  return toRecord(meta)
}

export async function deleteDrawing(id: string): Promise<boolean> {
  if (!isDrawingId(id)) return false
  const index = await readIndex()
  const next = index.filter((d) => d.id !== id)
  if (next.length === index.length) return false
  await writeIndex(next)
  try {
    await unlink(drawingPath(id))
  } catch {
    // ignore missing file
  }
  return true
}
