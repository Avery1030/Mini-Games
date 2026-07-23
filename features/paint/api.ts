import { http } from '@/lib/http'
import type { DrawingDetail, DrawingMeta } from './types'

type DrawingListResponse = { drawings: DrawingMeta[] }
type DrawingResponse = { drawing: DrawingDetail }
type DrawingWriteBody = { title?: string; imageBase64?: string }

export async function fetchDrawingList(): Promise<DrawingMeta[]> {
  const data = await http.get<DrawingListResponse>('/api/paint')
  return data.drawings
}

export async function fetchDrawing(id: string): Promise<DrawingDetail> {
  const data = await http.get<DrawingResponse>(`/api/paint/${id}`)
  return data.drawing
}

export async function createDrawingApi(input?: DrawingWriteBody): Promise<DrawingDetail> {
  const data = await http.post<DrawingResponse, DrawingWriteBody>('/api/paint', input ?? {})
  return {
    ...data.drawing,
    imageUrl: data.drawing.hasImage ? `/api/paint/file/${data.drawing.id}.png` : null,
  }
}

export async function updateDrawingApi(
  id: string,
  patch: DrawingWriteBody,
): Promise<DrawingDetail> {
  const data = await http.put<DrawingResponse, DrawingWriteBody>(`/api/paint/${id}`, patch)
  return data.drawing
}

export async function deleteDrawingApi(id: string): Promise<void> {
  await http.delete<{ ok: boolean }>(`/api/paint/${id}`)
}
