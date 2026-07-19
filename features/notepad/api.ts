import type { NoteDetail, NoteMeta } from './types'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data
}

export async function fetchNoteList(): Promise<NoteMeta[]> {
  const data = await parseJson<{ notes: NoteMeta[] }>(await fetch('/api/notepad'))
  return data.notes
}

export async function fetchNote(id: string): Promise<NoteDetail> {
  const data = await parseJson<{ note: NoteDetail }>(await fetch(`/api/notepad/${id}`))
  return data.note
}

export async function createNoteApi(input?: {
  title?: string
  content?: string
}): Promise<NoteDetail> {
  const data = await parseJson<{ note: NoteDetail }>(
    await fetch('/api/notepad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
    }),
  )
  return data.note
}

export async function updateNoteApi(
  id: string,
  patch: { title?: string; content?: string },
): Promise<NoteDetail> {
  const data = await parseJson<{ note: NoteDetail }>(
    await fetch(`/api/notepad/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return data.note
}

export async function deleteNoteApi(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(
    await fetch(`/api/notepad/${id}`, { method: 'DELETE' }),
  )
}
