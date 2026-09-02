import { z } from 'zod'
import { getExtension } from './path-utils'
import type { FileNode } from './types'

export const VFS_PATHS = {
  root: '/',
  desktop: '/Desktop',
  games: '/Games',
  documents: '/Documents',
  myComputer: '/My Computer',
  trash: '/Trash',
} as const

export const EXE_MIME = 'application/x-win95-exe'
export const VFS_DRAG_MIME = 'application/x-vfs-paths'

export type VfsItemType = 'folder' | 'file'

export type VfsIconKey =
  | 'folder'
  | 'desktop'
  | 'documents'
  | 'games'
  | 'computer'
  | 'trash'
  | 'txt'
  | 'wps'
  | 'et'
  | 'exe'
  | 'image'
  | 'code'
  | 'file'

export interface VfsItem {
  id: string
  name: string
  type: VfsItemType
  parentId: Nullable<string>
  extension: string
  content: string
  createdAt: number
  updatedAt: number
  icon: VfsIconKey
  /** 可执行程序（小游戏快捷方式） */
  executable: boolean
  /** 绝对路径（由树推导，刷新时写入便于查找） */
  path: string
  size: number
  mimeType?: string
  originalPath?: string
  trashedAt?: number
  appId?: string
}

export interface VfsClipboard {
  mode: 'copy' | 'cut'
  ids: string[]
}

export const VfsItemSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  type: z.enum(['folder', 'file']),
  parentId: z.string().max(80).nullable(),
  extension: z.string().max(16),
  content: z.string().max(800_000),
  createdAt: z.number(),
  updatedAt: z.number(),
  icon: z.enum([
    'folder',
    'desktop',
    'documents',
    'games',
    'computer',
    'trash',
    'txt',
    'wps',
    'et',
    'exe',
    'image',
    'code',
    'file',
  ]),
  executable: z.boolean(),
  path: z.string().min(1).max(500),
  size: z.number().min(0),
  mimeType: z.string().max(80).optional(),
  originalPath: z.string().max(500).optional(),
  trashedAt: z.number().optional(),
  appId: z.string().max(64).optional(),
})

export const VfsCatalogPersistSchema = z.object({
  version: z.literal(1),
  items: z.array(VfsItemSchema).max(2000),
})

export type VfsCatalogPersist = z.infer<typeof VfsCatalogPersistSchema>

export function parseExeContent(raw: string): Nullable<{ appId: string }> {
  try {
    const parsed = JSON.parse(raw) as { appId?: unknown }
    if (typeof parsed.appId === 'string' && parsed.appId.trim()) {
      return { appId: parsed.appId.trim() }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function encodeExeContent(appId: string): string {
  return JSON.stringify({ appId })
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'])
const CODE_EXT = new Set(['html', 'htm', 'css', 'js', 'ts', 'tsx', 'jsx', 'json'])

export function iconForPath(path: string, isDirectory: boolean, executable = false): VfsIconKey {
  if (isDirectory) {
    if (path === VFS_PATHS.desktop) return 'desktop'
    if (path === VFS_PATHS.documents) return 'documents'
    if (path === VFS_PATHS.games) return 'games'
    if (path === VFS_PATHS.myComputer) return 'computer'
    if (path === VFS_PATHS.trash) return 'trash'
    return 'folder'
  }
  if (executable) return 'exe'
  const ext = getExtension(path).toLowerCase()
  if (ext === 'wps') return 'wps'
  if (ext === 'et') return 'et'
  if (ext === 'txt') return 'txt'
  if (ext === 'exe') return 'exe'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (CODE_EXT.has(ext)) return 'code'
  return 'file'
}

export function fileNodeToItem(
  node: FileNode,
  parentId: Nullable<string>,
  extras?: { content?: string; executable?: boolean; appId?: string },
): VfsItem {
  const executable = extras?.executable ?? node.mimeType === EXE_MIME
  return {
    id: node.id,
    name: node.name,
    type: node.isDirectory ? 'folder' : 'file',
    parentId,
    extension: node.isDirectory ? '' : getExtension(node.path).toLowerCase(),
    content: extras?.content ?? '',
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    icon: iconForPath(node.path, node.isDirectory, executable),
    executable,
    path: node.path,
    size: node.size,
    mimeType: node.mimeType,
    originalPath: node.originalPath,
    trashedAt: node.trashedAt,
    appId: extras?.appId,
  }
}

export function sortVfsChildren(items: VfsItem[]): VfsItem[] {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function parseVfsDragPaths(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is string => typeof p === 'string' && p.startsWith('/'))
    }
  } catch {
    /* 纯路径 */
  }
  return trimmed
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.startsWith('/'))
}
