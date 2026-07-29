export type ImageExt = 'jpg' | 'png' | 'webp' | 'gif'

const THUMB_MAX_EDGE = 160

export function contentTypeForExt(ext: ImageExt): string {
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'image/jpeg'
  }
}

export function extFromMimeOrName(mime: string | null | undefined, nameOrUrl: string): ImageExt {
  const t = (mime || '').toLowerCase()
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('gif')) return 'gif'
  const lower = nameOrUrl.toLowerCase()
  if (lower.includes('.png')) return 'png'
  if (lower.includes('.webp')) return 'webp'
  if (lower.includes('.gif')) return 'gif'
  return 'jpg'
}

/** 浏览器内生成 JPEG 缩略图（最长边 160） */
export async function makeThumbBlob(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.72)
    })
  } catch {
    return null
  }
}
