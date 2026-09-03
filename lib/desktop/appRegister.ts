import { IMAGE_OPEN_EXTS, IDE_EXPLORER_OPEN_EXTS, getAppByExtension, type FileOpenEntry, type RegisteredAppKind } from '@/config/fileOpen'
import { getExtension, parseExeContent, EXE_MIME, type FileNode } from '@/lib/vfs'

export type { RegisteredAppKind, FileOpenEntry }
export type AppRegisterEntry = FileOpenEntry

export { getAppByExtension }

const IMAGE_OPEN_SET = new Set<string>(IMAGE_OPEN_EXTS)
const IDE_OPEN_SET = new Set<string>(IDE_EXPLORER_OPEN_EXTS)

function isImageOpenPath(path: string): boolean {
  const ext = getExtension(path).toLowerCase()
  const key = ext === 'jpeg' ? 'jpg' : ext
  return IMAGE_OPEN_SET.has(key)
}

function isIdeOpenPath(path: string): boolean {
  return IDE_OPEN_SET.has(getExtension(path).toLowerCase())
}

export function resolveOpenTarget(
  path: string,
  node?: Pick<FileNode, 'isDirectory' | 'mimeType'>,
): AppRegisterEntry {
  if (node?.isDirectory) return { kind: 'folder' }
  if (isImageOpenPath(path)) return { kind: 'image' }
  if (isIdeOpenPath(path)) return { kind: 'ide' }
  const ext = getExtension(path).toLowerCase()
  const mapped = getAppByExtension(ext)
  if (mapped.kind === 'writer' || mapped.kind === 'sheet') return mapped
  if (ext === 'exe' || node?.mimeType === EXE_MIME) return { kind: 'exe' }
  return mapped
}

export { parseExeContent }
