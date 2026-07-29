export type { FileContent, FileNode, StoredFileNode } from './types'
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
