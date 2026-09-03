/**
 * 内存 VFS（路径树 + 适配器）。不依赖 React / 桌面 store / 具体 App。
 * 后续独立开源以本文件为导出面。
 */
export type { FileContent, FileNode, StoredFileNode } from './types'
export type { VfsItem, VfsItemType, VfsIconKey, VfsClipboard, VfsCatalogPersist } from './catalog'
export {
  VFS_PATHS,
  EXE_MIME,
  VFS_DRAG_MIME,
  VfsItemSchema,
  VfsCatalogPersistSchema,
  iconForPath,
  fileNodeToItem,
  sortVfsChildren,
  parseVfsDragPaths,
  parseExeContent,
  encodeExeContent,
} from './catalog'
export { subscribeVfsChange, emitVfsChange } from './events'
export { VfsError, isVfsError, type VfsErrorCode } from './errors'
export {
  normalizePath,
  getParentPath,
  getBasename,
  getExtension,
  joinPath,
  assertValidName,
  nextConflictName,
} from './path-utils'
export { sanitizeFileStem } from './fileName'
export { VFS, vfs, TRASH_PATH } from './vfs'
