import { getExtension, vfs } from '@/lib/vfs'
import { isImagePath } from '@/features/image-viewer/api'
import { isIdeExplorerOpenPath } from '@/features/ide/languages'
import { useImageViewerStore } from '@/features/image-viewer/store'
import { useNotepadStore } from '@/features/notepad/store'
import { requestOpenNote } from '@/features/notepad/pendingOpen'
import { officeKindFromPath } from '@/features/office/fileTypes'
import '@/features/office/store'
import { openIdeFile } from '@/lib/desktop/window/ideWindows'
import { openOfficeFile } from '@/lib/desktop/window/officeWindows'

export type OpenVfsFileKind = 'image' | 'text' | 'code' | 'office' | 'unsupported'

/**
 * 按 VFS 路径打开对应应用（图片 → 查看器，代码 → IDE，txt → 记事本，wps/et → 办公）。
 * 不放在 lib/vfs 桶导出中，避免 store/window ↔ registry 循环依赖。
 */
export async function openVfsFile(filePath: string): Promise<OpenVfsFileKind> {
  if (isImagePath(filePath)) {
    useImageViewerStore.getState().openFile(filePath)
    return 'image'
  }

  if (isIdeExplorerOpenPath(filePath)) {
    openIdeFile(filePath)
    return 'code'
  }

  const officeKind = officeKindFromPath(filePath)
  if (officeKind) {
    try {
      const { node } = await vfs.readFile(filePath)
      openOfficeFile(officeKind, node.id, node.name)
      return 'office'
    } catch {
      return 'unsupported'
    }
  }

  const ext = getExtension(filePath).toLowerCase()
  if (ext === 'txt') {
    try {
      const { node } = await vfs.readFile(filePath)
      useNotepadStore.getState().setLastNoteId(node.id)
      requestOpenNote(node.id)
      const { useWindowStore } = await import('@/store/window')
      useWindowStore.getState().openWindow('notepad')
      return 'text'
    } catch {
      return 'unsupported'
    }
  }

  return 'unsupported'
}
