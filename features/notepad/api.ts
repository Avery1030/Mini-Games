import {
  getBasename,
  getExtension,
  sanitizeFileStem,
  vfs,
  type FileNode,
} from '@/lib/vfs'
import type { NoteDetail, NoteMeta } from './types'

type NoteWriteBody = { title?: string; content?: string }

const NOTES_DIR = '/Documents'
const MAX_TITLE = 80
const MAX_CONTENT_BYTES = 512 * 1024
const MAX_NOTES = 100

function titleFromNode(node: FileNode): string {
  const base = getBasename(node.path)
  if (base.toLowerCase().endsWith('.txt')) {
    return base.slice(0, -4) || base
  }
  return base
}

function assertContent(content: unknown): string {
  if (typeof content !== 'string') throw new Error('内容必须是文本')
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
    throw new Error('Text too large (max 512KB)')
  }
  return content
}

function sanitizeTitle(raw: unknown, fallback = 'Untitled'): string {
  return sanitizeFileStem(raw, fallback).slice(0, MAX_TITLE)
}

function toMeta(node: FileNode): NoteMeta {
  return {
    id: node.id,
    title: titleFromNode(node),
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

function toDetail(node: FileNode, content: string): NoteDetail {
  return { ...toMeta(node), content }
}

function isTxtFile(node: FileNode): boolean {
  return !node.isDirectory && getExtension(node.path).toLowerCase() === 'txt'
}

export async function fetchNoteList(): Promise<NoteMeta[]> {
  const children = await vfs.readDir(NOTES_DIR)
  return children
    .filter(isTxtFile)
    .map(toMeta)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function fetchNote(id: string): Promise<NoteDetail> {
  const { content, node } = await vfs.readFileById(id)
  if (typeof content !== 'string') throw new Error('笔记内容损坏')
  if (!isTxtFile(node)) throw new Error('笔记不存在')
  return toDetail(node, content)
}

export async function createNoteApi(input?: NoteWriteBody): Promise<NoteDetail> {
  const list = await fetchNoteList()
  if (list.length >= MAX_NOTES) throw new Error(`Note limit reached (${MAX_NOTES})`)

  const title = sanitizeTitle(input?.title)
  const content = assertContent(input?.content ?? '')
  const path = await vfs.allocateUniquePath(NOTES_DIR, `${title}.txt`)
  const node = await vfs.writeFile(path, content, 'text/plain')
  return toDetail(node, content)
}

export async function updateNoteApi(id: string, patch: NoteWriteBody): Promise<NoteDetail> {
  const existing = await vfs.getNodeById(id)
  if (!existing || !isTxtFile(existing)) throw new Error('笔记不存在')

  const { content: prevContent } = await vfs.readFileById(id)
  if (typeof prevContent !== 'string') throw new Error('笔记内容损坏')

  const title =
    patch.title !== undefined ? sanitizeTitle(patch.title, titleFromNode(existing)) : titleFromNode(existing)
  const content = patch.content !== undefined ? assertContent(patch.content) : prevContent

  let path = existing.path
  const desiredName = `${title}.txt`
  if (getBasename(path) !== desiredName) {
    const nextPath = await vfs.allocateUniquePath(NOTES_DIR, desiredName)
    const renamed = await vfs.renameFile(path, nextPath)
    path = renamed.path
  }

  const node = await vfs.writeFile(path, content, 'text/plain')
  return toDetail(node, content)
}

export async function deleteNoteApi(id: string): Promise<void> {
  const node = await vfs.getNodeById(id)
  if (!node || !isTxtFile(node)) throw new Error('笔记不存在')
  // 永久删除（回收站 purge / 记事本删除）
  await vfs.removeFile(node.path)
}
