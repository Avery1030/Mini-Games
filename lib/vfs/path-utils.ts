import { VfsError } from './errors'

/** 文件名禁止的特殊字符：\/:*?"<>| */
const INVALID_NAME_CHARS = /[\\/:*?"<>|]/

/**
 * 将路径标准化为绝对路径。
 * - 折叠多余 `/`
 * - 去掉末尾 `/`（根 `/` 除外）
 * - 拒绝相对路径与 `.` / `..` 段
 */
export function normalizePath(path: string): string {
  if (typeof path !== 'string' || path.length === 0) {
    throw new VfsError('PermissionError', 'Path must be a non-empty absolute path')
  }
  if (!path.startsWith('/')) {
    throw new VfsError('PermissionError', 'Relative paths are not allowed')
  }

  const segments = path.split('/')
  const out: string[] = []
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      throw new VfsError('PermissionError', 'Path segment ".." is not allowed')
    }
    assertValidName(seg)
    out.push(seg)
  }

  if (out.length === 0) return '/'
  return `/${out.join('/')}`
}

/** 获取父目录路径；根目录的父路径仍为 `/` */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return '/'
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx) || '/'
}

/** 获取路径最后一段（文件名或目录名）；根为 `/` */
export function getBasename(path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return '/'
  const idx = normalized.lastIndexOf('/')
  return normalized.slice(idx + 1)
}

/**
 * 获取文件后缀（不含点）；无后缀或目录名无点时返回空字符串。
 * 例：`note.txt` → `txt`，`archive.tar.gz` → `gz`
 */
export function getExtension(path: string): string {
  const name = getBasename(path)
  if (name === '/' || name === '.' || name === '..') return ''
  const idx = name.lastIndexOf('.')
  if (idx <= 0) return ''
  return name.slice(idx + 1)
}

/** 拼接路径段并规范化 */
export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return '/'
  const joined = parts
    .map((p, i) => {
      if (i === 0) return p
      return p.replace(/^\/+/, '')
    })
    .filter((p) => p.length > 0)
    .join('/')
  return normalizePath(joined.startsWith('/') ? joined : `/${joined}`)
}

/** 校验单段文件/目录名是否合法 */
export function assertValidName(name: string): void {
  if (!name || name === '.' || name === '..') {
    throw new VfsError('PermissionError', `Invalid name: ${name}`)
  }
  if (INVALID_NAME_CHARS.test(name)) {
    throw new VfsError('PermissionError', `Name contains illegal characters: ${name}`)
  }
}

/**
 * 为冲突项生成下一个候选名：`a.txt` → `a (1).txt` → `a (2).txt`
 */
export function nextConflictName(name: string, attempt: number): string {
  if (attempt <= 0) return name
  const idx = name.lastIndexOf('.')
  if (idx > 0) {
    const stem = name.slice(0, idx)
    const ext = name.slice(idx)
    return `${stem} (${attempt})${ext}`
  }
  return `${name} (${attempt})`
}

/** 存储用父路径：根的子项父路径为 `/`，根自身为 `''` */
export function toParentPathKey(path: string): string {
  const normalized = normalizePath(path)
  if (normalized === '/') return ''
  return getParentPath(normalized)
}
