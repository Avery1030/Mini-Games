import { getExtension } from '@/lib/vfs'

export const IDE_FILE_EXTS = ['js', 'ts', 'html', 'htm', 'css', 'json', 'txt'] as const

export type IdeFileExt = (typeof IDE_FILE_EXTS)[number]

export type IdeLanguage = 'markup' | 'css' | 'javascript' | 'typescript' | 'json' | 'plain'

const EXT_SET = new Set<string>(IDE_FILE_EXTS)

/** 资源管理器双击打开 IDE（txt 仍走记事本） */
const EXPLORER_EXT_SET = new Set(['js', 'ts', 'html', 'htm', 'css', 'json'])

export function isIdeFilePath(path: string): boolean {
  return EXT_SET.has(getExtension(path).toLowerCase())
}

export function isIdeExplorerOpenPath(path: string): boolean {
  return EXPLORER_EXT_SET.has(getExtension(path).toLowerCase())
}

export function languageFromPath(path: Nullable<string>): IdeLanguage {
  if (!path) return 'plain'
  switch (getExtension(path).toLowerCase()) {
    case 'html':
    case 'htm':
      return 'markup'
    case 'css':
      return 'css'
    case 'js':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'json':
      return 'json'
    default:
      return 'plain'
  }
}

export function mimeFromPath(path: string): string {
  switch (getExtension(path).toLowerCase()) {
    case 'html':
    case 'htm':
      return 'text/html'
    case 'css':
      return 'text/css'
    case 'js':
      return 'text/javascript'
    case 'ts':
      return 'text/typescript'
    case 'json':
      return 'application/json'
    default:
      return 'text/plain'
  }
}

export function isHtmlPath(path: Nullable<string>): boolean {
  if (!path) return false
  const ext = getExtension(path).toLowerCase()
  return ext === 'html' || ext === 'htm'
}
