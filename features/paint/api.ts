import type { DrawingDetail, DrawingMeta } from './types'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
  }
  return data
}

export async function fetchDrawingList(): Promise<DrawingMeta[]> {
  const data = await parseJson<{ drawings: DrawingMeta[] }>(await fetch('/api/paint'))
  return data.drawings
}

export async function fetchDrawing(id: string): Promise<DrawingDetail> {
  const data = await parseJson<{ drawing: DrawingDetail }>(await fetch(`/api/paint/${id}`))
  return data.drawing
}

export async function createDrawingApi(input?: {
  title?: string
  imageBase64?: string
}): Promise<DrawingDetail> {
  const data = await parseJson<{ drawing: DrawingDetail }>(
    await fetch('/api/paint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input ?? {}),
    }),
  )
  return {
    ...data.drawing,
    imageUrl: data.drawing.hasImage ? `/api/paint/file/${data.drawing.id}.png` : null,
  }
}

export async function updateDrawingApi(
  id: string,
  patch: { title?: string; imageBase64?: string },
): Promise<DrawingDetail> {
  const data = await parseJson<{ drawing: DrawingDetail }>(
    await fetch(`/api/paint/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  )
  return data.drawing
}

export async function deleteDrawingApi(id: string): Promise<void> {
  await parseJson<{ ok: boolean }>(await fetch(`/api/paint/${id}`, { method: 'DELETE' }))
}
