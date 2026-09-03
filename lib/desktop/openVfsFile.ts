import { getExtension, parseExeContent, vfs } from '@/lib/vfs'
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
 * 本文件是桌面壳的业务组装点（依赖各 App store），不是可抽离基础设施。
 */
export async function openVfsFile(filePath: string): Promise<OpenVfsFileKind> {
  try {
    await vfs.readDir(filePath)
    spawnExplorerWindow({ path: filePath })?.open()
    return 'folder'
  } catch {
    /* 按文件打开 */
  }

  const hint = resolveOpenTarget(filePath)
  if (hint.kind === 'image') {
    useImageViewerStore.getState().openFile(filePath)
    return 'image'
  }

  if (hint.kind === 'ide') {
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
