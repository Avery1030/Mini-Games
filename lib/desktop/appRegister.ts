import { getAppByExtension, type FileOpenEntry, type RegisteredAppKind } from '@/config/fileOpen'
import { getExtension, parseExeContent, EXE_MIME, type FileNode } from '@/lib/vfs'
import { isImagePath } from '@/features/image-viewer/api'
import { isIdeExplorerOpenPath } from '@/features/ide/languages'

export type { RegisteredAppKind, FileOpenEntry }
export type AppRegisterEntry = FileOpenEntry

export { getAppByExtension }

export function resolveOpenTarget(
  path: string,
  node?: Pick<FileNode, 'isDirectory' | 'mimeType'>,
): AppRegisterEntry {
  if (node?.isDirectory) return { kind: 'folder' }
  if (isImagePath(path)) return { kind: 'image' }
  if (isIdeExplorerOpenPath(path)) return { kind: 'ide' }
  const ext = getExtension(path).toLowerCase()
  const mapped = getAppByExtension(ext)
  if (mapped.kind === 'writer' || mapped.kind === 'sheet') return mapped
  if (ext === 'exe' || node?.mimeType === EXE_MIME) return { kind: 'exe' }
  return mapped
}

export { parseExeContent }
