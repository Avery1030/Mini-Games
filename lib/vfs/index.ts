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
