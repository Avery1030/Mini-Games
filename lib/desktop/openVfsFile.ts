import { getExtension, parseExeContent, vfs } from '@/lib/vfs'
import { isImagePath } from '@/features/image-viewer/api'
import { isIdeExplorerOpenPath } from '@/features/ide/languages'
import { useImageViewerStore } from '@/features/image-viewer/store'
import { useNotepadStore } from '@/features/notepad/store'
import { requestOpenNote } from '@/features/notepad/pendingOpen'
import { officeKindFromPath } from '@/features/office/fileTypes'
import '@/features/office/store'
import { openIdeFile } from '@/lib/desktop/window/ideWindows'
import { openOfficeFile } from '@/lib/desktop/window/officeWindows'
import { resolveOpenTarget } from '@/lib/desktop/appRegister'
import { spawnExplorerWindow } from '@/lib/desktop/window/explorerWindows'

export type OpenVfsFileKind = 'image' | 'text' | 'code' | 'office' | 'exe' | 'folder' | 'unsupported'

/**
 * 按应用注册表打开 VFS 路径（文件夹 → 资源管理器）。
 */
export async function openVfsFile(filePath: string): Promise<OpenVfsFileKind> {
  try {
    await vfs.readDir(filePath)
    spawnExplorerWindow({ path: filePath })?.open()
    return 'folder'
  } catch {
    /* 按文件打开 */
  }

  if (isImagePath(filePath)) {
    useImageViewerStore.getState().openFile(filePath)
    return 'image'
  }

  if (isIdeExplorerOpenPath(filePath)) {
    openIdeFile(filePath)
    return 'code'
  }

  try {
    const { content, node } = await vfs.readFile(filePath)
    const target = resolveOpenTarget(filePath, { isDirectory: false, mimeType: node.mimeType })

    if (target.kind === 'writer' || target.kind === 'sheet') {
      const kind = officeKindFromPath(filePath)
      if (!kind) return 'unsupported'
      openOfficeFile(kind, node.id, node.name)
      return 'office'
    }

    if (target.kind === 'notepad' || getExtension(filePath).toLowerCase() === 'txt') {
      useNotepadStore.getState().setLastNoteId(node.id)
      requestOpenNote(node.id)
      const { useWindowStore } = await import('@/store/window')
      useWindowStore.getState().openWindow('notepad')
      return 'text'
    }

    if (target.kind === 'exe') {
      const raw = typeof content === 'string' ? content : ''
      const parsed = parseExeContent(raw)
      if (!parsed) return 'unsupported'
      const { useWindowStore } = await import('@/store/window')
      useWindowStore.getState().openWindow(parsed.appId)
      return 'exe'
    }
  } catch {
    return 'unsupported'
  }

  return 'unsupported'
}
