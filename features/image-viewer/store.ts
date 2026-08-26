import { create } from 'zustand'
import { normalizePath, vfs } from '@/lib/vfs'

interface ImageViewerLaunchState {
  /** 待打开的 VFS 绝对路径 */
  pendingFilePath: string | null
  /** 递增以通知已打开的查看器重新加载 */
  openEpoch: number
}

interface ImageViewerLaunchActions {
  /**
   * 打开图片查看器并传入 VFS 文件路径。
   * 已打开时通过 openEpoch 通知重新加载。
   */
  openFile: (filePath: string) => void
  /** 按节点 id 解析路径后打开（回收站等场景） */
  openFileById: (id: string) => Promise<void>
  /** 取出并清空 pending 路径 */
  consumePendingFilePath: () => string | null
}

export type ImageViewerStore = ImageViewerLaunchState & ImageViewerLaunchActions

/**
 * 图片查看器启动总线：桌面 / 资源管理器 / 回收站通过 filePath 打开预览。
 * 故意不静态 import window store，避免与 registry 循环依赖。
 */
export const useImageViewerStore = create<ImageViewerStore>((set, get) => ({
  pendingFilePath: null,
  openEpoch: 0,

  openFile: (filePath) => {
    let path: string
    try {
      path = normalizePath(filePath)
    } catch {
      return
    }
    set((s) => ({
      pendingFilePath: path,
      openEpoch: s.openEpoch + 1,
    }))
    void import('@/store/window').then(({ useWindowStore }) => {
      useWindowStore.getState().openWindow('imageViewer')
    })
  },

  openFileById: async (id) => {
    if (!id) return
    try {
      const node = await vfs.getNodeById(id)
      if (!node || node.isDirectory) return
      get().openFile(node.path)
    } catch {
      // ignore
    }
  },

  consumePendingFilePath: () => {
    const path = get().pendingFilePath
    if (path) set({ pendingFilePath: null })
    return path
  },
}))
