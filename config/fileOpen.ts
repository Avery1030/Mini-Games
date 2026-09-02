/**
 * 文件打开注册表：后缀 → 启动应用。
 * 新增程序时在此登记，不要在业务组件里写死映射。
 */
export type RegisteredAppKind =
  | 'writer'
  | 'sheet'
  | 'notepad'
  | 'image'
  | 'ide'
  | 'exe'
  | 'folder'
  | 'unsupported'

export type FileOpenEntry = {
  kind: RegisteredAppKind
}

export const WRITER_EXT = 'wps'
export const SHEET_EXT = 'et'

/** 按扩展名直接映射的打开目标 */
export const FILE_OPEN_BY_EXT: Record<string, FileOpenEntry> = {
  [WRITER_EXT]: { kind: 'writer' },
  [SHEET_EXT]: { kind: 'sheet' },
  txt: { kind: 'notepad' },
  exe: { kind: 'exe' },
}

/** 图片查看器可打开的后缀（与原先 IMAGE_EXTS 集合一致） */
export const IMAGE_OPEN_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] as const

/** 资源管理器双击走 IDE 的后缀（txt 仍走记事本） */
export const IDE_EXPLORER_OPEN_EXTS = ['js', 'ts', 'html', 'htm', 'css', 'json'] as const

export function getAppByExtension(ext: string): FileOpenEntry {
  const key = ext.replace(/^\./, '').toLowerCase()
  return FILE_OPEN_BY_EXT[key] ?? { kind: 'unsupported' }
}
