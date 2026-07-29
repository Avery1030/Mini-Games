import { getCachedObjectUrl, rememberObjectUrl, revokeObjectUrl } from '@/lib/idb/objectUrl'
import {
  getBasename,
  getExtension,
  sanitizeFileStem,
  vfs,
  type FileNode,
} from '@/lib/vfs'
import type { DrawingDetail, DrawingMeta } from './types'

type DrawingWriteBody = { title?: string; imageBase64?: string }

const DRAWINGS_DIR = '/Pictures/Drawings'
const MAX_TITLE = 80
const MAX_PNG_BYTES = 10 * 1024 * 1024
const MAX_DRAWINGS = 80

function cacheKey(id: string) {
  return `drawing:${id}`
}

function titleFromNode(node: FileNode): string {
  const base = getBasename(node.path)
  if (base.toLowerCase().endsWith('.png')) {
    return base.slice(0, -4) || base
  }
  return base
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  return sanitizeFileStem(raw, fallback).slice(0, MAX_TITLE)
}

function isPngFile(node: FileNode): boolean {
  return !node.isDirectory && getExtension(node.path).toLowerCase() === 'png'
}

/** 解析 data URL 或纯 base64 为 PNG ArrayBuffer */
async function parsePngBase64(raw: unknown): Promise<ArrayBuffer> {
  if (typeof raw !== 'string' || !raw) throw new Error('Image data required')
  let b64 = raw
  const m = /^data:image\/png;base64,(.+)$/i.exec(raw)
  if (m) b64 = m[1]!
  else if (raw.startsWith('data:')) throw new Error('Only PNG data URL is supported')

  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  if (bytes.length === 0) throw new Error('Empty image')
  if (bytes.length > MAX_PNG_BYTES) throw new Error('Image too large (max 10MB)')
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new Error('Invalid PNG')
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function contentToBlob(content: ArrayBuffer): Blob {
  return new Blob([content], { type: 'image/png' })
}

function objectUrlFor(id: string, content: ArrayBuffer | null): string | null {
  if (!content || content.byteLength === 0) return null
  const key = cacheKey(id)
  return getCachedObjectUrl(key) ?? rememberObjectUrl(key, contentToBlob(content))
}

function toMeta(node: FileNode, hasImage: boolean): DrawingMeta {
  return {
    id: node.id,
    title: titleFromNode(node),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    hasImage,
  }
}

function toDetail(node: FileNode, content: ArrayBuffer | null): DrawingDetail {
  const hasImage = Boolean(content && content.byteLength > 0)
  return {
    ...toMeta(node, hasImage),
    imageUrl: objectUrlFor(node.id, content),
  }
}

async function readPngContent(id: string): Promise<{ node: FileNode; content: ArrayBuffer }> {
  const { content, node } = await vfs.readFileById(id)
  if (!isPngFile(node)) throw new Error('画作不存在')
  if (typeof content === 'string') {
    return { node, content: new TextEncoder().encode(content).buffer }
  }
  return { node, content }
}

export async function fetchDrawingList(): Promise<DrawingMeta[]> {
  const children = await vfs.readDir(DRAWINGS_DIR)
  const list: DrawingMeta[] = []
  for (const node of children.filter(isPngFile)) {
    list.push(toMeta(node, node.size > 0))
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function fetchDrawing(id: string): Promise<DrawingDetail> {
  const { node, content } = await readPngContent(id)
  return toDetail(node, content)
}

export async function createDrawingApi(input?: DrawingWriteBody): Promise<DrawingDetail> {
  const list = await fetchDrawingList()
  if (list.length >= MAX_DRAWINGS) throw new Error(`Drawing limit reached (${MAX_DRAWINGS})`)

  const title = sanitizeTitle(input?.title)
  const content = input?.imageBase64 ? await parsePngBase64(input.imageBase64) : new ArrayBuffer(0)
  const path = await vfs.allocateUniquePath(DRAWINGS_DIR, `${title}.png`)
  const node = await vfs.writeFile(path, content, 'image/png')
  revokeObjectUrl(cacheKey(node.id))
  if (content.byteLength > 0) {
    rememberObjectUrl(cacheKey(node.id), contentToBlob(content))
  }
  return toDetail(node, content)
}

export async function updateDrawingApi(id: string, patch: DrawingWriteBody): Promise<DrawingDetail> {
  const existing = await vfs.getNodeById(id)
  if (!existing || !isPngFile(existing)) throw new Error('画作不存在')

  const prev = await readPngContent(id)
  const title =
    patch.title !== undefined ? sanitizeTitle(patch.title, titleFromNode(existing)) : titleFromNode(existing)
  const content = patch.imageBase64 ? await parsePngBase64(patch.imageBase64) : prev.content

  let path = existing.path
  const desiredName = `${title}.png`
  if (getBasename(path) !== desiredName) {
    const nextPath = await vfs.allocateUniquePath(DRAWINGS_DIR, desiredName)
    const renamed = await vfs.renameFile(path, nextPath)
    path = renamed.path
  }

  const node = await vfs.writeFile(path, content, 'image/png')
  revokeObjectUrl(cacheKey(node.id))
  if (content.byteLength > 0) {
    rememberObjectUrl(cacheKey(node.id), contentToBlob(content))
  }
  return toDetail(node, content)
}

export async function deleteDrawingApi(id: string): Promise<void> {
  const node = await vfs.getNodeById(id)
  if (!node || !isPngFile(node)) throw new Error('画作不存在')
  await vfs.removeFile(node.path)
  revokeObjectUrl(cacheKey(id))
}
