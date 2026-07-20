import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import {
  allocateDesktopCoordinate,
  createDesktopFolderWindow,
  removeDesktopFolderWindow,
  renameDesktopFolderWindow,
  registerDesktopWindow,
  listDesktopWindows,
} from '@/lib/desktop/window'
import { FolderWindow } from '@/lib/desktop/window/apps'
import { useDesktopStore } from '@/store/desktop'

export type DesktopFolderRecord = {
  id: DesktopAppId
  title: string
  createdAt: number
}

type DesktopItemsState = {
  folders: DesktopFolderRecord[]
  _hasHydrated: boolean
}

type DesktopItemsActions = {
  setHasHydrated: (value: boolean) => void
  /** 右键新建文件夹：注册窗口 + 持久化元数据 */
  createFolder: (opts?: { title?: string; coordinate?: DesktopCoordinate; open?: boolean }) => DesktopFolderRecord | null
  renameFolder: (id: DesktopAppId, title: string) => void
  removeFolder: (id: DesktopAppId) => void
}

export type DesktopItemsStore = DesktopItemsState & DesktopItemsActions

function restoreFolderWindows(folders: DesktopFolderRecord[]) {
  const coords = useDesktopStore.getState().coordinates
  for (const folder of folders) {
    if (listDesktopWindows().some((w) => w.id === folder.id)) continue
    const coordinate = coords[folder.id]
    const win = new FolderWindow({
      id: folder.id,
      title: folder.title,
      coordinate,
    })
    registerDesktopWindow(win, { coordinate, syncStores: true })
  }
}

export const useDesktopItemsStore = create<DesktopItemsStore>()(
  persist(
    (set, get) => ({
      folders: [],
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      createFolder: (opts = {}) => {
        const occupied = Object.values(useDesktopStore.getState().coordinates)
        const coordinate = opts.coordinate ?? allocateDesktopCoordinate(occupied)
        const win = createDesktopFolderWindow({
          title: opts.title,
          coordinate,
          open: opts.open,
        })
        if (!win) return null
        const record: DesktopFolderRecord = {
          id: win.id,
          title: win.title,
          createdAt: Date.now(),
        }
        set({ folders: [...get().folders, record] })
        return record
      },

      renameFolder: (id, title) => {
        const trimmed = title.trim()
        if (!trimmed) return
        if (!renameDesktopFolderWindow(id, trimmed)) return
        set({
          folders: get().folders.map((f) => (f.id === id ? { ...f, title: trimmed } : f)),
        })
      },

      removeFolder: (id) => {
        removeDesktopFolderWindow(id)
        useDesktopStore.getState().removeCoordinate(id)
        set({ folders: get().folders.filter((f) => f.id !== id) })
      },
    }),
    {
      name: STORAGE_KEYS.desktopItems,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (state) => ({
        folders: state.folders,
      }),
      merge: (persisted, current) => {
        const saved = persisted as { folders?: DesktopFolderRecord[] } | undefined
        const folders = Array.isArray(saved?.folders)
          ? saved!.folders.filter(
              (f) => f && typeof f.id === 'string' && typeof f.title === 'string',
            )
          : []
        return { ...current, folders }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.folders?.length) {
          restoreFolderWindows(state.folders)
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)
