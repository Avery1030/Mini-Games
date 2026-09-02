import type { DragEvent } from 'react'
import { VFS_DRAG_MIME, parseVfsDragPaths } from '@/lib/vfs'

export function vfsPathsFromDrag(e: DragEvent): string[] {
  return parseVfsDragPaths(e.dataTransfer.getData(VFS_DRAG_MIME) || e.dataTransfer.getData('text/plain'))
}

export function preventVfsFileDrag(e: DragEvent): void {
  if (e.dataTransfer.types.includes(VFS_DRAG_MIME) || e.dataTransfer.types.includes('text/plain')) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
}
