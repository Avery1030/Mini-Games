import { create } from 'zustand'
import { getExtension, vfs, type FileNode } from '@/lib/vfs'

const DESKTOP_DIR = '/Desktop'

type DesktopVfsState = {
  files: FileNode[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * 桌面 VFS 文件列表（`/Desktop` 下非目录项）。
 * 图标层订阅此 store，与 desktopItems 并存。
 */
export const useDesktopVfsStore = create<DesktopVfsState>((set) => ({
  files: [],
  loading: false,

  refresh: async () => {
    set({ loading: true })
    try {
      const children = await vfs.readDir(DESKTOP_DIR)
      const files = children
        .filter((n) => !n.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      set({ files, loading: false })
    } catch {
      set({ files: [], loading: false })
    }
  },
}))

export function isVfsDesktopFileId(id: string): boolean {
  return id.startsWith('/Desktop/')
}

export function getVfsDesktopFileExt(path: string): string {
  return getExtension(path).toLowerCase()
}
