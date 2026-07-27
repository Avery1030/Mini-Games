import {
  deleteImage,
  fetchRemoteImageBlob,
  imageObjectUrls,
  listImages,
  saveImageFromFile,
  saveImageFromRemote,
  type ImageRecord,
} from '@/lib/idb'
import type { ImageItem } from './types'

function toItem(rec: ImageRecord): ImageItem {
  const { url, thumbUrl } = imageObjectUrls(rec)
  return {
    id: rec.id,
    title: rec.title,
    filename: rec.filename,
    contentType: rec.contentType,
    size: rec.size,
    source: rec.source,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    url,
    thumbUrl,
  }
}

export async function fetchImageList(): Promise<ImageItem[]> {
  const list = await listImages()
  return list.map(toItem)
}

export async function uploadImagesApi(files: File[]): Promise<ImageItem[]> {
  const out: ImageItem[] = []
  for (const file of files) {
    out.push(toItem(await saveImageFromFile(file)))
  }
  return out
}

export async function importImageUrlApi(url: string): Promise<ImageItem> {
  const { blob, contentType } = await fetchRemoteImageBlob(url)
  let nameHint = 'image'
  try {
    nameHint = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image')
  } catch {
    // ignore
  }
  const rec = await saveImageFromRemote({ blob, contentType, nameHint })
  return toItem(rec)
}

export async function deleteImageApi(id: string): Promise<void> {
  const ok = await deleteImage(id)
  if (!ok) throw new Error('图片不存在')
}
