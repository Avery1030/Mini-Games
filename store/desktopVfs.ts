import { create } from 'zustand'
import { getExtension, subscribeVfsChange, vfs, type FileNode } from '@/lib/vfs'
import { VFS_PATHS } from '@/lib/vfs/catalog'

type DesktopVfsState = {
  files: FileNode[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * 桌面 = `/Desktop` 目录内容（文件 + 文件夹）。
 */
export const useDesktopVfsStore = create<DesktopVfsState>((set) => ({
  files: [],
  loading: false,

  refresh: async () => {
    set({ loading: true })
    try {
      const children = await vfs.readDir(VFS_PATHS.desktop)
      const files = [...children].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      set({ files, loading: false })
    } catch {
      set({ files: [], loading: false })
    }
  },
}))

if (typeof window !== 'undefined') {
  subscribeVfsChange(() => {
    void useDesktopVfsStore.getState().refresh()
  })
}

export function isVfsDesktopFileId(id: string): boolean {
  return id.startsWith(`${VFS_PATHS.desktop}/`)
}

export function getVfsDesktopFileExt(path: string): string {
  return getExtension(path).toLowerCase()
}
