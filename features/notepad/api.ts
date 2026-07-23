import { http } from '@/lib/http'
import type { NoteDetail, NoteMeta } from './types'

type NoteListResponse = { notes: NoteMeta[] }
type NoteResponse = { note: NoteDetail }
type NoteWriteBody = { title?: string; content?: string }

export async function fetchNoteList(): Promise<NoteMeta[]> {
  const data = await http.get<NoteListResponse>('/api/notepad')
  return data.notes
}

export async function fetchNote(id: string): Promise<NoteDetail> {
  const data = await http.get<NoteResponse>(`/api/notepad/${id}`)
  return data.note
}

export async function createNoteApi(input?: NoteWriteBody): Promise<NoteDetail> {
  const data = await http.post<NoteResponse, NoteWriteBody>('/api/notepad', input ?? {})
  return data.note
}

export async function updateNoteApi(id: string, patch: NoteWriteBody): Promise<NoteDetail> {
  const data = await http.put<NoteResponse, NoteWriteBody>(`/api/notepad/${id}`, patch)
  return data.note
}

export async function deleteNoteApi(id: string): Promise<void> {
  await http.delete<{ ok: boolean }>(`/api/notepad/${id}`)
}
