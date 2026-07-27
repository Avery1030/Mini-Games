import {
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
  type NoteRecord,
} from '@/lib/idb'
import type { NoteDetail, NoteMeta } from './types'

type NoteWriteBody = { title?: string; content?: string }

function toDetail(n: NoteRecord): NoteDetail {
  return { id: n.id, title: n.title, content: n.content, createdAt: n.createdAt, updatedAt: n.updatedAt }
}

export async function fetchNoteList(): Promise<NoteMeta[]> {
  return listNotes()
}

export async function fetchNote(id: string): Promise<NoteDetail> {
  const note = await getNote(id)
  if (!note) throw new Error('笔记不存在')
  return toDetail(note)
}

export async function createNoteApi(input?: NoteWriteBody): Promise<NoteDetail> {
  return toDetail(await createNote(input))
}

export async function updateNoteApi(id: string, patch: NoteWriteBody): Promise<NoteDetail> {
  const note = await updateNote(id, patch)
  if (!note) throw new Error('笔记不存在')
  return toDetail(note)
}

export async function deleteNoteApi(id: string): Promise<void> {
  const ok = await deleteNote(id)
  if (!ok) throw new Error('笔记不存在')
}
