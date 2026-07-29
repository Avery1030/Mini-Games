import { fetchRemoteImageBlob } from '@/lib/idb/fetchRemote'
import {
  contentTypeForExt,
  extFromMimeOrName,
  makeThumbBlob,
  type ImageExt,
} from '@/lib/idb/imageUtils'
import { getCachedObjectUrl, rememberObjectUrl, revokeObjectUrl } from '@/lib/idb/objectUrl'
import {
  getBasename,
  getExtension,
  normalizePath,
  sanitizeFileStem,
  vfs,
  type FileNode,
} from '@/lib/vfs'
import type { ImageItem } from './types'

export const PICTURES_DIR = '/Pictures'
const DRAWINGS_DIR = '/Pictures/Drawings'
const MAX_TITLE = 80
const MAX_BYTES = 10 * 1024 * 1024
const MAX_IMAGES = 100

export const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'])

function urlKey(id: string) {
  return `image:${id}`
}
function thumbKey(id: string) {
  return `image-thumb:${id}`
}

function fileExt(ext: ImageExt): string {
  return ext === 'jpg' ? 'jpg' : ext
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  return sanitizeFileStem(raw, fallback).slice(0, MAX_TITLE)
}

function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim()
  return sanitizeTitle(base || 'Untitled')
}

function titleFromNode(node: FileNode): string {
  const base = getBasename(node.path)
  const ext = getExtension(node.path)
  if (ext && base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    return base.slice(0, -(ext.length + 1)) || base
  }
  return base
}

/** 按路径扩展名判断是否为支持的图片 */
export function isImagePath(path: string): boolean {
  const ext = getExtension(path).toLowerCase()
  const normalized = ext === 'jpeg' ? 'jpg' : ext
  return IMAGE_EXTS.has(normalized)
}

/** 是否为图片查看器可识别的 VFS 图片节点（图库列表排除 Drawings） */
export function isViewerImageNode(node: FileNode): boolean {
  if (node.isDirectory) return false
  if (node.path === DRAWINGS_DIR || node.path.startsWith(`${DRAWINGS_DIR}/`)) return false
  return isImagePath(node.path)
}

async function contentToBlob(content: ArrayBuffer | string, mime: string): Promise<Blob> {
  if (typeof content === 'string') {
    return new Blob([content], { type: mime })
  }
  return new Blob([content], { type: mime })
}

async function toItem(
  node: FileNode,
  content: ArrayBuffer | string,
  source: 'upload' | 'url' = 'upload',
): Promise<ImageItem> {
  const mime = node.mimeType || contentTypeForExt(extFromMimeOrName(node.mimeType, node.name))
  const blob = await contentToBlob(content, mime)
  const url = getCachedObjectUrl(urlKey(node.id)) ?? rememberObjectUrl(urlKey(node.id), blob)

  let thumbUrl = getCachedObjectUrl(thumbKey(node.id))
  if (!thumbUrl) {
    const thumb = (await makeThumbBlob(blob)) ?? blob
    thumbUrl = rememberObjectUrl(thumbKey(node.id), thumb)
  }

  return {
    id: node.id,
    path: node.path,
    title: titleFromNode(node),
    filename: getBasename(node.path),
    contentType: mime,
    size: node.size,
    origin: 'vfs',
    source,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    url,
    thumbUrl,
  }
}

async function saveImageBlob(input: {
  blob: Blob
  ext: ImageExt
  title?: string
  source: 'upload' | 'url'
  parentDir?: string
}): Promise<ImageItem> {
  if (input.blob.size === 0) throw new Error('图片为空')
  if (input.blob.size > MAX_BYTES) throw new Error('图片请小于 10MB')

  const parentDir = input.parentDir ?? PICTURES_DIR
  const existing = (await vfs.readDir(parentDir)).filter((n) => !n.isDirectory && isImagePath(n.path))
  if (existing.length >= MAX_IMAGES) throw new Error(`图片数量已达上限（${MAX_IMAGES}）`)

  const title = sanitizeTitle(input.title, 'Untitled')
  const ext = fileExt(input.ext)
  const path = await vfs.allocateUniquePath(parentDir, `${title}.${ext}`)
  const buffer = await input.blob.arrayBuffer()
  const mime =
    input.blob.type && input.blob.type.startsWith('image/')
      ? input.blob.type
      : contentTypeForExt(input.ext)
  const node = await vfs.writeFile(path, buffer, mime)
  revokeObjectUrl(urlKey(node.id))
  revokeObjectUrl(thumbKey(node.id))
  return toItem(node, buffer, input.source)
}

/** 图库列表：VFS `/Pictures` 下持久化图片（不含 Drawings） */
export async function fetchImageList(): Promise<ImageItem[]> {
  const children = await vfs.readDir(PICTURES_DIR)
  const files = children.filter(isViewerImageNode).sort((a, b) => b.createdAt - a.createdAt)
  const out: ImageItem[] = []
  for (const node of files) {
    const { content } = await vfs.readFile(node.path)
    out.push(await toItem(node, content))
  }
  return out
}

/** 本地上传 → 写入 VFS `/Pictures` */
export async function uploadImagesApi(files: File[]): Promise<ImageItem[]> {
  const out: ImageItem[] = []
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) throw new Error('请选择图片文件')
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
      throw new Error('仅支持图片文件')
    }
    if (file.size > MAX_BYTES) throw new Error('图片请小于 10MB')
    const ext = extFromMimeOrName(file.type, file.name)
    out.push(
      await saveImageBlob({
        blob: file,
        ext,
        title: titleFromFileName(file.name),
        source: 'upload',
      }),
    )
  }
  return out
}

/**
 * 将网络图片写入 VFS（显式「导入」）。
 * 仅粘贴预览请用 UI 临时 URL，勿调用本方法。
 */
export async function importImageUrlApi(url: string): Promise<ImageItem> {
  const { blob, contentType } = await fetchRemoteImageBlob(url)
  let nameHint = 'image'
  try {
    nameHint = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image')
  } catch {
    // ignore
  }
  const ext = extFromMimeOrName(contentType ?? blob.type, nameHint)
  return saveImageBlob({
    blob,
    ext,
    title: titleFromFileName(nameHint),
    source: 'url',
  })
}

/** 按 VFS 绝对路径读取并渲染 */
export async function fetchImageByPath(filePath: string): Promise<ImageItem> {
  const path = normalizePath(filePath)
  const { content, node } = await vfs.readFile(path)
  if (!isImagePath(node.path)) throw new Error('不是图片文件')
  return toItem(node, content)
}

/** 按节点 id 读取（含回收站等非 /Pictures 路径） */
export async function fetchImageById(id: string): Promise<ImageItem> {
  const { content, node } = await vfs.readFileById(id)
  if (node.isDirectory) throw new Error('图片不存在')
  if (!isImagePath(node.path)) throw new Error('不是图片文件')
  return toItem(node, content)
}

/** 移入回收站（软删除），禁止永久删除 */
export async function trashImageApi(target: { id?: string; path?: string }): Promise<void> {
  let path = target.path
  let id = target.id
  if (!path) {
    if (!id) throw new Error('图片不存在')
    const node = await vfs.getNodeById(id)
    if (!node || node.isDirectory) throw new Error('图片不存在')
    path = node.path
  }
  const normalized = normalizePath(path)
  if (!id) {
    try {
      const { node } = await vfs.readFile(normalized)
      id = node.id
    } catch {
      // ignore
    }
  }
  await vfs.trash(normalized)
  if (id) {
    revokeObjectUrl(urlKey(id))
    revokeObjectUrl(thumbKey(id))
  }
  if (normalized.startsWith('/Desktop/')) {
    const { useDesktopVfsStore } = await import('@/store/desktopVfs')
    void useDesktopVfsStore.getState().refresh()
  }
}

/** @deprecated 使用 trashImageApi */
export async function deleteImageApi(id: string): Promise<void> {
  await trashImageApi({ id })
}
