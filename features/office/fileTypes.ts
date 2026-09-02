import { getExtension } from '@/lib/vfs'
import type { OfficeKind } from './schema'

export const OFFICE_DIR = '/Documents'
export const WRITER_EXT = 'wps'
export const SHEET_EXT = 'et'

export function officeExt(kind: OfficeKind): string {
  return kind === 'writer' ? WRITER_EXT : SHEET_EXT
}

export function officeKindFromPath(path: string): Nullable<OfficeKind> {
  const ext = getExtension(path).toLowerCase()
  if (ext === WRITER_EXT) return 'writer'
  if (ext === SHEET_EXT) return 'sheet'
  return null
}
