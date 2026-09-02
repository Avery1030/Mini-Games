import { BuiltinAppId } from '@/config/desktop'
import { getExtension, parseExeContent, EXE_MIME, type FileNode } from '@/lib/vfs'
import { isImagePath } from '@/features/image-viewer/api'
import { isIdeExplorerOpenPath } from '@/features/ide/languages'
import { officeKindFromPath } from '@/features/office/fileTypes'

export type RegisteredAppKind = 'writer' | 'sheet' | 'notepad' | 'image' | 'ide' | 'exe' | 'folder' | 'unsupported'

export type AppRegisterEntry = {
  kind: RegisteredAppKind
  /** 内置窗口 id；exe 时从文件内容读取 */
  appId?: BuiltinAppId
}

const EXT_MAP: Record<string, AppRegisterEntry> = {
  wps: { kind: 'writer' },
  et: { kind: 'sheet' },
  txt: { kind: 'notepad' },
  exe: { kind: 'exe' },
}

export function getAppByExtension(ext: string): AppRegisterEntry {
  const key = ext.replace(/^\./, '').toLowerCase()
  return EXT_MAP[key] ?? { kind: 'unsupported' }
}

export function resolveOpenTarget(
  path: string,
  node?: Pick<FileNode, 'isDirectory' | 'mimeType'>,
): AppRegisterEntry {
  if (node?.isDirectory) return { kind: 'folder' }
  if (isImagePath(path)) return { kind: 'image' }
  if (isIdeExplorerOpenPath(path)) return { kind: 'ide' }
  const office = officeKindFromPath(path)
  if (office === 'writer') return { kind: 'writer' }
  if (office === 'sheet') return { kind: 'sheet' }
  const ext = getExtension(path).toLowerCase()
  if (ext === 'exe' || node?.mimeType === EXE_MIME) return { kind: 'exe' }
  return getAppByExtension(ext)
}

export { parseExeContent }
