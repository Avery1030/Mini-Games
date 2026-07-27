import { IDB_STORES, idbDelete, idbGet, idbGetAll, idbPut, newId } from './db'

export type NoteRecord = {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export type NoteMeta = Omit<NoteRecord, 'content'>

const MAX_TITLE = 80
const MAX_CONTENT_BYTES = 512 * 1024
const MAX_NOTES = 100
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isNoteId(id: unknown): id is string {
  return typeof id === 'string' && ID_RE.test(id)
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/[\r\n\t]+/g, ' ') : ''
  if (!s) return fallback
  return s.slice(0, MAX_TITLE)
}

function assertContent(content: unknown): string {
  if (typeof content !== 'string') throw new Error('内容必须是文本')
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
    throw new Error('Text too large (max 512KB)')
  }
  return content
}

function toMeta(n: NoteRecord): NoteMeta {
  return { id: n.id, title: n.title, createdAt: n.createdAt, updatedAt: n.updatedAt }
}

export async function listNotes(): Promise<NoteMeta[]> {
  const all = await idbGetAll<NoteRecord>(IDB_STORES.notes)
  return all.map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getNote(id: string): Promise<NoteRecord | null> {
  if (!isNoteId(id)) return null
  return (await idbGet<NoteRecord>(IDB_STORES.notes, id)) ?? null
}

export async function createNote(input?: { title?: string; content?: string }): Promise<NoteRecord> {
  const all = await idbGetAll<NoteRecord>(IDB_STORES.notes)
  if (all.length >= MAX_NOTES) throw new Error(`Note limit reached (${MAX_NOTES})`)

  const now = Date.now()
  const note: NoteRecord = {
    id: newId(),
    title: sanitizeTitle(input?.title),
    content: assertContent(input?.content ?? ''),
    createdAt: now,
    updatedAt: now,
  }
  await idbPut(IDB_STORES.notes, note)
  return note
}

export async function updateNote(
  id: string,
  patch: { title?: string; content?: string },
): Promise<NoteRecord | null> {
  if (!isNoteId(id)) return null
  const prev = await idbGet<NoteRecord>(IDB_STORES.notes, id)
  if (!prev) return null

  const next: NoteRecord = {
    ...prev,
    title: patch.title !== undefined ? sanitizeTitle(patch.title, prev.title) : prev.title,
    content: patch.content !== undefined ? assertContent(patch.content) : prev.content,
    updatedAt: Date.now(),
  }
  await idbPut(IDB_STORES.notes, next)
  return next
}

export async function deleteNote(id: string): Promise<boolean> {
  if (!isNoteId(id)) return false
  const prev = await idbGet<NoteRecord>(IDB_STORES.notes, id)
  if (!prev) return false
  await idbDelete(IDB_STORES.notes, id)
  return true
}
