export type VfsErrorCode =
  | 'FileNotFound'
  | 'ExistError'
  | 'IsDirectory'
  | 'NotDirectory'
  | 'PermissionError'
  | 'StorageQuota'

const DEFAULT_MESSAGES: Record<VfsErrorCode, string> = {
  FileNotFound: 'File not found',
  ExistError: 'File already exists',
  IsDirectory: 'Target is a directory',
  NotDirectory: 'Target is not a directory',
  PermissionError: 'Permission denied',
  StorageQuota: 'Storage quota exceeded',
}

/** VFS 统一错误，前端可按 code 弹窗捕获 */
export class VfsError extends Error {
  readonly code: VfsErrorCode

  constructor(code: VfsErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'VfsError'
    this.code = code
  }
}

export function isVfsError(err: unknown): err is VfsError {
  return err instanceof VfsError
}
