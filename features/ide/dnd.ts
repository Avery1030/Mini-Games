export const VFS_PATH_MIME = 'application/x-vfs-path'

export function isVfsFileDrag(dt: Nullable<DataTransfer>): boolean {
  if (!dt) return false
  const types = Array.from(dt.types)
  return types.includes(VFS_PATH_MIME) || types.includes('text/plain')
}

export function readVfsPathFromDataTransfer(dt: Nullable<DataTransfer>): Nullable<string> {
  if (!dt) return null
  const raw = (dt.getData(VFS_PATH_MIME) || dt.getData('text/plain')).trim()
  if (!raw.startsWith('/') || raw.includes('\n') || raw.includes('\0')) return null
  return raw
}

export function writeVfsPathToDataTransfer(dt: DataTransfer, path: string) {
  dt.setData(VFS_PATH_MIME, path)
  dt.setData('text/plain', path)
  dt.effectAllowed = 'copy'
}
