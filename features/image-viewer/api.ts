import { http, HttpError } from '@/lib/http'
import type { ImageItem } from './types'

type ListResponse = { images: ImageItem[] }
type UploadResponse = { images: ImageItem[] }
type ImportResponse = { image: ImageItem }

function withThumb(img: ImageItem): ImageItem {
  return {
    ...img,
    thumbUrl: img.thumbUrl || `/api/image-viewer/thumb/${img.id}`,
  }
}

export async function fetchImageList(): Promise<ImageItem[]> {
  const data = await http.get<ListResponse>('/api/image-viewer')
  return data.images.map(withThumb)
}

export async function uploadImagesApi(files: File[]): Promise<ImageItem[]> {
  const form = new FormData()
  for (const file of files) form.append('file', file)
  const res = await fetch('/api/image-viewer', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as UploadResponse & { error?: string }
  if (!res.ok) {
    throw new HttpError(data.error || '上传失败', res.status, data, res)
  }
  return (data.images ?? []).map(withThumb)
}

export async function importImageUrlApi(url: string): Promise<ImageItem> {
  const data = await http.post<ImportResponse, { url: string }>('/api/image-viewer', { url })
  return withThumb(data.image)
}

export async function deleteImageApi(id: string): Promise<void> {
  await http.delete<{ ok: boolean }>(`/api/image-viewer/${id}`)
}
