import { access, readFile, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { IMAGE_VIEWER_DATA_DIR } from './dir'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const THUMB_MAX_EDGE = 160
const THUMB_QUALITY = 72

function assertImageId(id: string) {
  if (!ID_RE.test(id)) throw new Error('无效 ID')
}

export function thumbFileName(id: string): string {
  assertImageId(id)
  return `${id}.thumb.jpg`
}

export function thumbPath(id: string): string {
  return path.join(IMAGE_VIEWER_DATA_DIR, thumbFileName(id))
}

export function publicThumbUrl(id: string): string {
  return `/api/image-viewer/thumb/${id}`
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

/** 从原图生成 JPEG 缩略图（最长边 160） */
export async function writeThumbFromBuffer(id: string, buffer: Buffer): Promise<void> {
  const out = await sharp(buffer)
    .rotate()
    .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
    .toBuffer()
  await writeFile(thumbPath(id), out)
}

/** 读取缩略图；缺失时从原图现场生成并缓存 */
export async function readOrCreateThumb(id: string, originalFilename: string): Promise<Buffer | null> {
  if (!ID_RE.test(id)) return null
  const tPath = thumbPath(id)
  if (await exists(tPath)) {
    try {
      return await readFile(tPath)
    } catch {
      return null
    }
  }

  const originalPath = path.join(IMAGE_VIEWER_DATA_DIR, originalFilename)
  try {
    const original = await readFile(originalPath)
    await writeThumbFromBuffer(id, original)
    return await readFile(tPath)
  } catch {
    return null
  }
}
