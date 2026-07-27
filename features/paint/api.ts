import {
  createDrawing,
  deleteDrawing,
  drawingObjectUrl,
  getDrawing,
  listDrawings,
  updateDrawing,
  type DrawingRecord,
} from '@/lib/idb'
import type { DrawingDetail, DrawingMeta } from './types'

type DrawingWriteBody = { title?: string; imageBase64?: string }

function toDetail(rec: DrawingRecord): DrawingDetail {
  return {
    id: rec.id,
    title: rec.title,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    hasImage: Boolean(rec.png),
    imageUrl: drawingObjectUrl(rec),
  }
}

function toMeta(rec: DrawingRecord): DrawingMeta {
  return {
    id: rec.id,
    title: rec.title,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    hasImage: Boolean(rec.png),
  }
}

export async function fetchDrawingList(): Promise<DrawingMeta[]> {
  const list = await listDrawings()
  return list.map(toMeta)
}

export async function fetchDrawing(id: string): Promise<DrawingDetail> {
  const rec = await getDrawing(id)
  if (!rec) throw new Error('画作不存在')
  return toDetail(rec)
}

export async function createDrawingApi(input?: DrawingWriteBody): Promise<DrawingDetail> {
  return toDetail(await createDrawing(input))
}

export async function updateDrawingApi(id: string, patch: DrawingWriteBody): Promise<DrawingDetail> {
  const rec = await updateDrawing(id, patch)
  if (!rec) throw new Error('画作不存在')
  return toDetail(rec)
}

export async function deleteDrawingApi(id: string): Promise<void> {
  const ok = await deleteDrawing(id)
  if (!ok) throw new Error('画作不存在')
}
