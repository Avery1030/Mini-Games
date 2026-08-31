import { IdbAdapter, type StorageAdapter } from './adapter'
import { VfsError } from './errors'
import {
  getBasename,
  getParentPath,
  joinPath,
  nextConflictName,
  normalizePath,
  toParentPathKey,
} from './path-utils'
import type { FileContent, FileNode, StoredFileNode } from './types'

/** 系统隐藏回收站目录（bootstrap 自动创建） */
export const TRASH_PATH = '/Trash'

const BOOTSTRAP_DIRS = [
  '/',
  '/Desktop',
  '/Documents',
  '/Documents/Chats',
  '/Pictures',
  '/Pictures/Drawings',
  '/Wallpapers',
  '/Wallpapers/3d',
  TRASH_PATH,
] as const

function newId(): string {
  return crypto.randomUUID()
}

function contentSize(content: FileContent): number {
  if (typeof content === 'string') {
    return new TextEncoder().encode(content).byteLength
  }
  return content.byteLength
}

function isTrashItemPath(path: string): boolean {
  return isUnderPath(path, TRASH_PATH) && path !== TRASH_PATH
}

function toPublicNode(node: StoredFileNode): FileNode {
  const publicNode: FileNode = {
    id: node.id,
    path: node.path,
    name: node.name,
    isDirectory: node.isDirectory,
    mimeType: node.mimeType,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    size: node.size,
  }
  // originalPath / trashedAt 仅对 /Trash 内条目对外暴露
  if (isTrashItemPath(node.path)) {
    if (node.originalPath !== undefined) publicNode.originalPath = node.originalPath
    if (node.trashedAt !== undefined) publicNode.trashedAt = node.trashedAt
  }
  return publicNode
}

function stripTrashMeta(node: StoredFileNode): StoredFileNode {
  const next: StoredFileNode = { ...node }
  delete next.originalPath
  delete next.trashedAt
  return next
}

function makeDirNode(path: string, now = Date.now()): StoredFileNode {
  const normalized = normalizePath(path)
  return {
    id: newId(),
    path: normalized,
    name: normalized === '/' ? '/' : getBasename(normalized),
    isDirectory: true,
    createdAt: now,
    updatedAt: now,
    size: 0,
    parentPath: toParentPathKey(normalized),
  }
}

function isUnderPath(childPath: string, parentPath: string): boolean {
  if (parentPath === '/') return childPath !== '/'
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`)
}

function replacePathPrefix(path: string, fromPrefix: string, toPrefix: string): string {
  if (fromPrefix === '/') {
    return joinPath(toPrefix, path.slice(1))
  }
  if (path === fromPrefix) return toPrefix
  return joinPath(toPrefix, path.slice(fromPrefix.length + 1))
}

/** VFS 核心：仅通过 StorageAdapter 访问存储，不直连 IndexedDB */
export class VFS {
  private bootstrapped = false

  constructor(private readonly adapter: StorageAdapter) {}

  private async ensureBootstrapped(): Promise<void> {
    if (this.bootstrapped) return
    const now = Date.now()
    for (const dir of BOOTSTRAP_DIRS) {
      const existing = await this.adapter.getMeta(dir)
      if (!existing) {
        await this.adapter.putMeta(makeDirNode(dir, now))
      } else if (!existing.isDirectory) {
        throw new VfsError('ExistError', `Bootstrap path is a file: ${dir}`)
      }
    }
    this.bootstrapped = true
  }

  private async requireMeta(path: string): Promise<StoredFileNode> {
    const normalized = normalizePath(path)
    const meta = await this.adapter.getMeta(normalized)
    if (!meta) throw new VfsError('FileNotFound', `Not found: ${normalized}`)
    return meta
  }

  private async ensureParentDir(path: string): Promise<void> {
    const parent = getParentPath(path)
    if (parent === path && path === '/') return
    const meta = await this.adapter.getMeta(parent)
    if (!meta) throw new VfsError('FileNotFound', `Parent directory not found: ${parent}`)
    if (!meta.isDirectory) throw new VfsError('NotDirectory', `Parent is not a directory: ${parent}`)
  }

  /** 在 parent 下找一个不冲突的目标路径 */
  async allocateUniquePath(parentDir: string, baseName: string): Promise<string> {
    await this.ensureBootstrapped()
    const parent = normalizePath(parentDir)
    let attempt = 0
    for (;;) {
      const name = nextConflictName(baseName, attempt)
      const candidate = parent === '/' ? `/${name}` : joinPath(parent, name)
      const exists = await this.adapter.getMeta(candidate)
      if (!exists) return candidate
      attempt += 1
      if (attempt > 10_000) {
        throw new VfsError('ExistError', `Cannot allocate unique name under ${parent}`)
      }
    }
  }

  private async collectSubtree(rootPath: string): Promise<StoredFileNode[]> {
    const all = await this.adapter.listAllMeta()
    return all.filter((n) => isUnderPath(n.path, rootPath)).sort((a, b) => b.path.length - a.path.length)
  }

  private async moveNodeTree(
    srcPath: string,
    destPath: string,
    options?: { originalPath?: Nullable<string> },
  ): Promise<StoredFileNode> {
    const src = await this.requireMeta(srcPath)
    const normalizedDest = normalizePath(destPath)

    if (srcPath === normalizedDest) return src

    if (isUnderPath(normalizedDest, srcPath) && src.isDirectory) {
      throw new VfsError('PermissionError', 'Cannot move a directory into itself')
    }

    const existing = await this.adapter.getMeta(normalizedDest)
    if (existing) throw new VfsError('ExistError', `Already exists: ${normalizedDest}`)

    await this.ensureParentDir(normalizedDest)

    // 深→浅：先删旧 path 再写新 path，避免 id 唯一索引冲突
    const subtree = src.isDirectory
      ? (await this.adapter.listAllMeta())
          .filter((n) => isUnderPath(n.path, srcPath))
          .sort((a, b) => b.path.length - a.path.length)
      : [src]

    const now = Date.now()
    let movedRoot: Nullable<StoredFileNode> = null

    for (const node of subtree) {
      const nextPath = replacePathPrefix(node.path, srcPath, normalizedDest)
      const next: StoredFileNode = {
        ...node,
        path: nextPath,
        name: nextPath === '/' ? '/' : getBasename(nextPath),
        parentPath: toParentPathKey(nextPath),
        updatedAt: now,
      }

      if (node.path === srcPath) {
        if (options?.originalPath === null) {
          delete next.originalPath
        } else if (options?.originalPath !== undefined) {
          next.originalPath = options.originalPath
        }
      }

      if (node.path !== nextPath) {
        await this.adapter.deleteMeta(node.path)
      }
      await this.adapter.putMeta(next)

      if (nextPath === normalizedDest) movedRoot = next
    }

    if (!movedRoot) throw new VfsError('FileNotFound', `Move failed: ${normalizedDest}`)
    return movedRoot
  }

  private async removeNodeRecursive(path: string): Promise<void> {
    const normalized = normalizePath(path)
    const meta = await this.adapter.getMeta(normalized)
    if (!meta) throw new VfsError('FileNotFound', `Not found: ${normalized}`)

    if (normalized === '/') {
      throw new VfsError('PermissionError', 'Cannot remove root directory')
    }

    const subtree = meta.isDirectory ? await this.collectSubtree(normalized) : [meta]
    for (const node of subtree) {
      if (!node.isDirectory) {
        await this.adapter.deleteContent(node.id)
      }
      await this.adapter.deleteMeta(node.path)
    }
  }

  async readFile(path: string): Promise<{ content: FileContent; node: FileNode }> {
    await this.ensureBootstrapped()
    const meta = await this.requireMeta(path)
    if (meta.isDirectory) throw new VfsError('IsDirectory', `Is a directory: ${meta.path}`)
    const content = await this.adapter.getContent(meta.id)
    if (content === null) throw new VfsError('FileNotFound', `Content missing: ${meta.path}`)
    return { content, node: toPublicNode(meta) }
  }

  async writeFile(path: string, content: FileContent, mimeType?: string): Promise<FileNode> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    if (normalized === '/') throw new VfsError('IsDirectory', 'Cannot write to root')

    await this.ensureParentDir(normalized)

    const existing = await this.adapter.getMeta(normalized)
    if (existing?.isDirectory) {
      throw new VfsError('IsDirectory', `Is a directory: ${normalized}`)
    }

    const now = Date.now()
    const size = contentSize(content)
    const node: StoredFileNode = existing
      ? {
          ...existing,
          mimeType: mimeType ?? existing.mimeType,
          updatedAt: now,
          size,
        }
      : {
          id: newId(),
          path: normalized,
          name: getBasename(normalized),
          isDirectory: false,
          mimeType,
          createdAt: now,
          updatedAt: now,
          size,
          parentPath: toParentPathKey(normalized),
        }

    await this.adapter.putContent(node.id, content)
    await this.adapter.putMeta(node)
    return toPublicNode(node)
  }

  /**
   * 永久删除文件或目录（不可恢复）。
   * 回收站内单项永久删除也应调用此接口，禁止对 Trash 内条目再次 trash。
   */
  async removeFile(path: string): Promise<void> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    if (normalized === TRASH_PATH) {
      throw new VfsError('PermissionError', 'Cannot permanently delete the Trash directory itself')
    }
    await this.removeNodeRecursive(normalized)
  }

  async renameFile(oldPath: string, newPath: string): Promise<FileNode> {
    await this.ensureBootstrapped()
    const moved = await this.moveNodeTree(normalizePath(oldPath), normalizePath(newPath))
    return toPublicNode(moved)
  }

  async copyFile(srcPath: string, destPath: string): Promise<FileNode> {
    await this.ensureBootstrapped()
    const src = await this.requireMeta(srcPath)
    const normalizedDest = normalizePath(destPath)

    if (isUnderPath(normalizedDest, src.path) && src.isDirectory) {
      throw new VfsError('PermissionError', 'Cannot copy a directory into itself')
    }

    const existing = await this.adapter.getMeta(normalizedDest)
    if (existing) throw new VfsError('ExistError', `Already exists: ${normalizedDest}`)
    await this.ensureParentDir(normalizedDest)

    const now = Date.now()

    if (!src.isDirectory) {
      const content = await this.adapter.getContent(src.id)
      if (content === null) throw new VfsError('FileNotFound', `Content missing: ${src.path}`)
      const node: StoredFileNode = {
        id: newId(),
        path: normalizedDest,
        name: getBasename(normalizedDest),
        isDirectory: false,
        mimeType: src.mimeType,
        createdAt: now,
        updatedAt: now,
        size: src.size,
        parentPath: toParentPathKey(normalizedDest),
      }
      await this.adapter.putContent(node.id, content)
      await this.adapter.putMeta(node)
      return toPublicNode(node)
    }

    const subtree = (await this.adapter.listAllMeta())
      .filter((n) => isUnderPath(n.path, src.path))
      .sort((a, b) => a.path.length - b.path.length)

    let rootCopy: Nullable<StoredFileNode> = null

    for (const node of subtree) {
      const nextPath = replacePathPrefix(node.path, src.path, normalizedDest)
      const nextId = newId()
      const next: StoredFileNode = {
        id: nextId,
        path: nextPath,
        name: nextPath === '/' ? '/' : getBasename(nextPath),
        isDirectory: node.isDirectory,
        mimeType: node.mimeType,
        createdAt: now,
        updatedAt: now,
        size: node.isDirectory ? 0 : node.size,
        parentPath: toParentPathKey(nextPath),
      }

      if (!node.isDirectory) {
        const content = await this.adapter.getContent(node.id)
        if (content === null) throw new VfsError('FileNotFound', `Content missing: ${node.path}`)
        await this.adapter.putContent(nextId, content)
      }

      await this.adapter.putMeta(next)
      if (nextPath === normalizedDest) rootCopy = next
    }

    if (!rootCopy) throw new VfsError('FileNotFound', `Copy failed: ${normalizedDest}`)
    return toPublicNode(rootCopy)
  }

  async moveFile(srcPath: string, destPath: string): Promise<FileNode> {
    await this.ensureBootstrapped()
    const moved = await this.moveNodeTree(normalizePath(srcPath), normalizePath(destPath))
    return toPublicNode(moved)
  }

  async mkdir(path: string): Promise<FileNode> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    if (normalized === '/') {
      const root = await this.requireMeta('/')
      return toPublicNode(root)
    }

    const existing = await this.adapter.getMeta(normalized)
    if (existing) {
      if (existing.isDirectory) throw new VfsError('ExistError', `Already exists: ${normalized}`)
      throw new VfsError('ExistError', `A file exists at path: ${normalized}`)
    }

    // 递归确保父目录存在
    const parent = getParentPath(normalized)
    if (parent !== '/' && !(await this.adapter.getMeta(parent))) {
      await this.mkdir(parent)
    } else {
      await this.ensureParentDir(normalized)
    }

    const node = makeDirNode(normalized)
    await this.adapter.putMeta(node)
    return toPublicNode(node)
  }

  /**
   * 列出目录子项。
   * 普通浏览时隐藏系统目录 `/Trash`；回收站页面请直接 `readDir('/Trash')`。
   */
  async readDir(path: string): Promise<FileNode[]> {
    await this.ensureBootstrapped()
    const meta = await this.requireMeta(path)
    if (!meta.isDirectory) throw new VfsError('NotDirectory', `Not a directory: ${meta.path}`)
    const children = await this.adapter.listChildren(meta.path)
    return children
      .filter((n) => !(meta.path === '/' && n.path === TRASH_PATH))
      .map(toPublicNode)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    return (await this.adapter.getMeta(normalized)) !== null
  }

  /**
   * 软删除：移动至 `/Trash`，写入 originalPath / trashedAt。
   * 禁止对回收站内部文件再次调用。
   */
  async trash(path: string): Promise<void> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    if (normalized === '/' || normalized === TRASH_PATH) {
      throw new VfsError('PermissionError', `Cannot trash: ${normalized}`)
    }
    if (isUnderPath(normalized, TRASH_PATH)) {
      throw new VfsError('PermissionError', 'Item is already in Trash')
    }

    const src = await this.requireMeta(normalized)
    const destPath = await this.allocateUniquePath(TRASH_PATH, src.name)
    const moved = await this.moveFile(normalized, destPath)
    const meta = await this.requireMeta(moved.path)
    await this.adapter.putMeta({
      ...meta,
      originalPath: normalized,
      trashedAt: Date.now(),
    })
  }

  /**
   * 从回收站还原到 originalPath；目标冲突时自动重命名。
   */
  async restore(path: string): Promise<void> {
    await this.ensureBootstrapped()
    const normalized = normalizePath(path)
    if (!isTrashItemPath(normalized)) {
      throw new VfsError('PermissionError', `Not a trash item: ${normalized}`)
    }

    const src = await this.requireMeta(normalized)
    const original = src.originalPath
    if (!original) {
      throw new VfsError('PermissionError', `Missing original path for: ${normalized}`)
    }

    const originalParent = getParentPath(original)
    if (!(await this.adapter.getMeta(originalParent))) {
      await this.mkdir(originalParent)
    }

    const baseName = getBasename(original)
    const destParent = getParentPath(original)
    const destPath =
      (await this.adapter.getMeta(original)) === null
        ? original
        : await this.allocateUniquePath(destParent, baseName)

    const moved = await this.moveFile(normalized, destPath)
    const meta = await this.requireMeta(moved.path)
    await this.adapter.putMeta(stripTrashMeta(meta))
  }

  /** 永久删除回收站内全部内容 */
  async clearTrash(): Promise<void> {
    await this.ensureBootstrapped()
    const children = await this.adapter.listChildren(TRASH_PATH)
    for (const child of children) {
      await this.removeFile(child.path)
    }
  }

  async search(keyword: string): Promise<FileNode[]> {
    await this.ensureBootstrapped()
    const q = keyword.trim().toLowerCase()
    if (!q) return []
    const all = await this.adapter.listAllMeta()
    return all
      .filter(
        (n) =>
          n.path !== '/' &&
          !isUnderPath(n.path, TRASH_PATH) &&
          n.name.toLowerCase().includes(q),
      )
      .map(toPublicNode)
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  async getTotalSize(): Promise<number> {
    await this.ensureBootstrapped()
    const all = await this.adapter.listAllMeta()
    return all.reduce((sum, n) => (n.isDirectory ? sum : sum + n.size), 0)
  }

  /** 按节点 id 查找元信息 */
  async getNodeById(id: string): Promise<Nullable<FileNode>> {
    await this.ensureBootstrapped()
    if (!id) return null
    const meta = await this.adapter.getMetaById(id)
    return meta ? toPublicNode(meta) : null
  }

  /** 按节点 id 读取文件内容 */
  async readFileById(id: string): Promise<{ content: FileContent; node: FileNode }> {
    await this.ensureBootstrapped()
    const meta = await this.adapter.getMetaById(id)
    if (!meta) throw new VfsError('FileNotFound', `Not found id: ${id}`)
    if (meta.isDirectory) throw new VfsError('IsDirectory', `Is a directory: ${meta.path}`)
    const content = await this.adapter.getContent(meta.id)
    if (content === null) throw new VfsError('FileNotFound', `Content missing: ${meta.path}`)
    return { content, node: toPublicNode(meta) }
  }
}

/** 默认单例：IndexedDB 适配器 */
export const vfs = new VFS(new IdbAdapter())
