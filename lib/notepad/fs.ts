import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NOTES_DATA_DIR, NOTES_INDEX_FILE } from './dir'

export type NoteMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export type NoteRecord = NoteMeta & {
  content: string
}

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_TITLE = 80
const MAX_CONTENT_BYTES = 512 * 1024
const MAX_NOTES = 100

export function isNoteId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

function notePath(id: string): string {
  if (!isNoteId(id)) throw new Error('无效的笔记 ID')
  return path.join(NOTES_DATA_DIR, `${id}.txt`)
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, MAX_TITLE)
}

function assertContent(content: unknown): string {
  if (typeof content !== 'string') throw new Error('内容必须是文本')
  const bytes = Buffer.byteLength(content, 'utf8')
  if (bytes > MAX_CONTENT_BYTES) throw new Error('Text too large (max 512KB)')
  return content
}

async function ensureDir() {
  await mkdir(NOTES_DATA_DIR, { recursive: true })
}

async function readIndex(): Promise<NoteMeta[]> {
  await ensureDir()
  try {
    const raw = await readFile(NOTES_INDEX_FILE, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is NoteMeta =>
        !!item &&
        typeof item === 'object' &&
        isNoteId((item as NoteMeta).id) &&
        typeof (item as NoteMeta).title === 'string' &&
        typeof (item as NoteMeta).createdAt === 'number' &&
        typeof (item as NoteMeta).updatedAt === 'number',
    )
  } catch {
    return []
  }
}

async function writeIndex(notes: NoteMeta[]) {
  await ensureDir()
  const tmp = `${NOTES_INDEX_FILE}.${randomUUID()}.tmp`
  const body = JSON.stringify(notes, null, 2)
  await writeFile(tmp, body, 'utf8')
  await rename(tmp, NOTES_INDEX_FILE)
}

export async function listNotes(): Promise<NoteMeta[]> {
  const notes = await readIndex()
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getNote(id: string): Promise<NoteRecord | null> {
  if (!isNoteId(id)) return null
  const index = await readIndex()
  const meta = index.find((n) => n.id === id)
  if (!meta) return null
  try {
    const content = await readFile(notePath(id), 'utf8')
    return { ...meta, content }
  } catch {
    return null
  }
}

export async function createNote(input?: {
  title?: string
  content?: string
}): Promise<NoteRecord> {
  const index = await readIndex()
  if (index.length >= MAX_NOTES) {
    throw new Error(`Note limit reached (${MAX_NOTES})`)
  }

  const now = Date.now()
  const id = randomUUID()
  const content = assertContent(input?.content ?? '')
  const title = sanitizeTitle(input?.title)
  const meta: NoteMeta = { id, title, createdAt: now, updatedAt: now }

  await ensureDir()
  await writeFile(notePath(id), content, 'utf8')
  await writeIndex([meta, ...index])
  return { ...meta, content }
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string },
): Promise<NoteRecord | null> {
  if (!isNoteId(id)) return null
  const index = await readIndex()
  const idx = index.findIndex((n) => n.id === id)
  if (idx < 0) return null

  const prev = index[idx]!
  let content: string
  try {
    content = await readFile(notePath(id), 'utf8')
  } catch {
    content = ''
  }

  if (patch.content !== undefined) content = assertContent(patch.content)
  const title = patch.title !== undefined ? sanitizeTitle(patch.title, prev.title) : prev.title
  const meta: NoteMeta = { ...prev, title, updatedAt: Date.now() }

  await writeFile(notePath(id), content, 'utf8')
  const next = [...index]
  next[idx] = meta
  await writeIndex(next)
  return { ...meta, content }
}

export async function deleteNote(id: string): Promise<boolean> {
  if (!isNoteId(id)) return false
  const index = await readIndex()
  const next = index.filter((n) => n.id !== id)
  if (next.length === index.length) return false

  await writeIndex(next)
  try {
    await unlink(notePath(id))
  } catch {
    // 索引已更新；文件缺失时忽略
  }
  return true
}
