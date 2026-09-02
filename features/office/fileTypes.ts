import { SHEET_EXT, WRITER_EXT, getAppByExtension } from '@/config/fileOpen'
import { getExtension } from '@/lib/vfs'
import type { OfficeKind } from './schema'

export const OFFICE_DIR = '/Documents'
export { WRITER_EXT, SHEET_EXT }

export function officeExt(kind: OfficeKind): string {
  return kind === 'writer' ? WRITER_EXT : SHEET_EXT
}

export function officeKindFromPath(path: string): Nullable<OfficeKind> {
  const kind = getAppByExtension(getExtension(path)).kind
  if (kind === 'writer' || kind === 'sheet') return kind
  return null
}
