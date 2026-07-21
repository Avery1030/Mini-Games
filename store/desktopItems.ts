import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import type { DesktopItemRecord, DesktopResourceKind } from '@/lib/desktop/itemTypes'
import {
  getChildren,
  getDeletedDescendantIds,
  getDescendantIds,
  isDescendantOf,
  isSiblingTitleTaken,
  resolveParentId,
  uniqueSiblingTitle,
} from '@/lib/desktop/itemsTree'
import {
  allocateDesktopCoordinate,
  createDesktopFolderWindow,
  createDesktopTextDocumentWindow,
  removeDesktopItemWindow,
  renameDesktopItemWindow,
  registerDesktopWindow,
  listDesktopWindows,
  ensureWindowSlot,
} from '@/lib/desktop/window'
import { FolderWindow, TextDocumentWindow } from '@/lib/desktop/window/apps'
import { useDesktopStore } from '@/store/desktop'
import { createNoteApi, deleteNoteApi, updateNoteApi } from '@/features/notepad/api'

export type { DesktopItemRecord, DesktopResourceKind, DesktopFolderRecord } from '@/lib/desktop/itemTypes'

type DesktopItemsState = {
  items: DesktopItemRecord[]
  _hasHydrated: boolean
}

type CreateItemOpts = {
  title?: string
  coordinate?: DesktopCoordinate
  open?: boolean
  /** 父文件夹；null/缺省 = 桌面根 */
  parentId?: DesktopAppId | null
}

type DesktopItemsActions = {
  setHasHydrated: (value: boolean) => void
  createFolder: (opts?: CreateItemOpts) => DesktopItemRecord | null
  createTextDocument: (opts?: CreateItemOpts) => Promise<DesktopItemRecord | null>
  renameItem: (id: DesktopAppId, title: string) => Promise<boolean>
  setItemTitle: (id: DesktopAppId, title: string) => boolean
  renameFolder: (id: DesktopAppId, title: string) => void
  removeItem: (id: DesktopAppId) => void
  removeFolder: (id: DesktopAppId) => void
  /** 拖入文件夹（或同级移动） */
  moveItemIntoFolder: (id: DesktopAppId, folderId: DesktopAppId) => boolean
  /** 移回桌面根 */
  moveItemToDesktop: (id: DesktopAppId, coordinate?: DesktopCoordinate) => boolean
  moveToRecycleBin: (id: DesktopAppId) => boolean
  restoreFromRecycleBin: (id: DesktopAppId) => boolean
  purgeFromRecycleBin: (id: DesktopAppId) => Promise<boolean>
  emptyRecycleBin: () => Promise<number>
}

export type DesktopItemsStore = DesktopItemsState & DesktopItemsActions

function siblingTitlesOf(
  items: DesktopItemRecord[],
  kind: DesktopResourceKind,
  parentId: DesktopAppId | null,
): string[] {
  return getChildren(items, parentId)
    .filter((i) => i.kind === kind)
    .map((i) => i.title)
}

function registerItemWindow(
  item: DesktopItemRecord,
  opts: { title?: string; coordinate?: DesktopCoordinate; placeOnDesktop: boolean },
): boolean {
  if (listDesktopWindows().some((w) => w.id === item.id)) {
    if (opts.placeOnDesktop && opts.coordinate) {
      useDesktopStore.getState().ensureCoordinate(item.id, opts.coordinate)
    }
    ensureWindowSlot(item.id)
    return true
  }

  const title = opts.title ?? item.title
  if (item.kind === 'folder') {
    const win = new FolderWindow({
      id: item.id,
      title,
      coordinate: opts.coordinate,
    })
    return registerDesktopWindow(win, {
      coordinate: opts.coordinate,
      placeOnDesktop: opts.placeOnDesktop,
    })
  }
  if (item.kind === 'textDocument' && item.noteId) {
    const win = new TextDocumentWindow({
      id: item.id,
      title,
      noteId: item.noteId,
      coordinate: opts.coordinate,
    })
    return registerDesktopWindow(win, {
      coordinate: opts.coordinate,
      placeOnDesktop: opts.placeOnDesktop,
    })
  }
  return false
}

function restoreItemWindows(items: DesktopItemRecord[]) {
  const coords = useDesktopStore.getState().coordinates
  for (const item of items) {
    if (item.isDeleted) continue
    const onDesktop = resolveParentId(item.parentId) == null
    const coordinate = onDesktop ? coords[item.id] : undefined
    registerItemWindow(item, {
      coordinate,
      placeOnDesktop: onDesktop,
    })
    if (!onDesktop) {
      useDesktopStore.getState().removeCoordinate(item.id)
    }
  }
}

function normalizeItem(raw: Partial<DesktopItemRecord> & { id: string; title: string }): DesktopItemRecord | null {
  const kind: DesktopResourceKind =
    raw.kind === 'textDocument' ? 'textDocument' : 'folder'
  if (kind === 'textDocument' && typeof raw.noteId !== 'string') return null
  return {
    id: raw.id,
    kind,
    title: raw.title,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    noteId: kind === 'textDocument' ? raw.noteId : undefined,
    parentId: typeof raw.parentId === 'string' && raw.parentId ? raw.parentId : null,
    isDeleted: Boolean(raw.isDeleted),
    deletedAt: typeof raw.deletedAt === 'number' ? raw.deletedAt : undefined,
    deletedFromCoordinate: Array.isArray(raw.deletedFromCoordinate)
      ? (raw.deletedFromCoordinate as DesktopCoordinate)
      : undefined,
  }
}

async function deleteLinkedNote(item: DesktopItemRecord) {
  if (item.kind !== 'textDocument' || !item.noteId) return
  try {
    await deleteNoteApi(item.noteId)
  } catch {
    // ignore
  }
}

export const useDesktopItemsStore = create<DesktopItemsStore>()(
  persist(
    (set, get) => ({
      items: [],
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      createFolder: (opts = {}) => {
        const parentId = resolveParentId(opts.parentId)
        if (parentId != null) {
          const parent = get().items.find((i) => i.id === parentId && i.kind === 'folder' && !i.isDeleted)
          if (!parent) return null
        }

        const onDesktop = parentId == null
        const items = get().items
        const titles = siblingTitlesOf(items, 'folder', parentId)
        const occupied = Object.values(useDesktopStore.getState().coordinates)
        const coordinate = onDesktop
          ? allocateDesktopCoordinate(occupied, opts.coordinate ?? [4, 1])
          : undefined

        const win = createDesktopFolderWindow({
          title: opts.title,
          coordinate,
          siblingTitles: titles,
          placeOnDesktop: onDesktop,
          open: opts.open,
        })
        if (!win) return null

        const record: DesktopItemRecord = {
          id: win.id,
          kind: 'folder',
          title: win.title,
          createdAt: Date.now(),
          parentId,
        }
        set({ items: [...get().items, record] })
        return record
      },

      createTextDocument: async (opts = {}) => {
        const parentId = resolveParentId(opts.parentId)
        if (parentId != null) {
          const parent = get().items.find((i) => i.id === parentId && i.kind === 'folder' && !i.isDeleted)
          if (!parent) return null
        }

        const baseTitle = opts.title?.trim() || '新建文本文档'
        let note
        try {
          note = await createNoteApi({ title: baseTitle, content: '' })
        } catch {
          return null
        }

        const onDesktop = parentId == null
        const items = get().items
        const titles = siblingTitlesOf(items, 'textDocument', parentId)
        const occupied = Object.values(useDesktopStore.getState().coordinates)
        const coordinate = onDesktop
          ? allocateDesktopCoordinate(occupied, opts.coordinate ?? [4, 1])
          : undefined

        const win = createDesktopTextDocumentWindow({
          title: note.title || baseTitle,
          noteId: note.id,
          coordinate,
          siblingTitles: titles,
          placeOnDesktop: onDesktop,
          open: opts.open,
        })
        if (!win) {
          void deleteNoteApi(note.id).catch(() => {})
          return null
        }

        const record: DesktopItemRecord = {
          id: win.id,
          kind: 'textDocument',
          title: win.title,
          noteId: note.id,
          createdAt: Date.now(),
          parentId,
        }
        set({ items: [...get().items, record] })
        return record
      },

      renameItem: async (id, title) => {
        const trimmed = title.trim()
        if (!trimmed) return false
        const item = get().items.find((f) => f.id === id)
        if (!item || item.isDeleted) return false
        if (isSiblingTitleTaken(get().items, item.kind, trimmed, resolveParentId(item.parentId), id)) {
          return false
        }
        if (!renameDesktopItemWindow(id, item.kind, trimmed)) return false
        if (item.kind === 'textDocument' && item.noteId) {
          try {
            await updateNoteApi(item.noteId, { title: trimmed })
          } catch {
            // keep desktop title
          }
        }
        set({
          items: get().items.map((f) => (f.id === id ? { ...f, title: trimmed } : f)),
        })
        return true
      },

      setItemTitle: (id, title) => {
        const trimmed = title.trim()
        if (!trimmed) return false
        const item = get().items.find((f) => f.id === id)
        if (!item || item.isDeleted) return false
        if (isSiblingTitleTaken(get().items, item.kind, trimmed, resolveParentId(item.parentId), id)) {
          return false
        }
        if (!renameDesktopItemWindow(id, item.kind, trimmed)) return false
        set({
          items: get().items.map((f) => (f.id === id ? { ...f, title: trimmed } : f)),
        })
        return true
      },

      renameFolder: (id, title) => {
        void get().renameItem(id, title)
      },

      removeItem: (id) => {
        const items = get().items
        const root = items.find((f) => f.id === id)
        if (!root) return
        const subtree = [id, ...getDescendantIds(items, id)]
        const removeSet = new Set(subtree)
        const toDelete = items.filter((f) => removeSet.has(f.id))
        for (const f of toDelete) {
          removeDesktopItemWindow(f.id)
          useDesktopStore.getState().removeCoordinate(f.id)
        }
        set({ items: items.filter((f) => !removeSet.has(f.id)) })
        for (const f of toDelete) void deleteLinkedNote(f)
      },

      removeFolder: (id) => {
        get().removeItem(id)
      },

      moveItemIntoFolder: (id, folderId) => {
        if (id === folderId) return false
        const items = get().items
        const item = items.find((f) => f.id === id)
        const folder = items.find((f) => f.id === folderId)
        if (!item || item.isDeleted) return false
        if (!folder || folder.isDeleted || folder.kind !== 'folder') return false
        if (item.kind === 'folder' && isDescendantOf(items, id, folderId)) return false

        const title = uniqueSiblingTitle(
          items,
          item.kind,
          item.title,
          folderId,
          id,
        )
        if (title !== item.title) {
          renameDesktopItemWindow(id, item.kind, title)
        }

        useDesktopStore.getState().removeCoordinate(id)
        set({
          items: items.map((f) =>
            f.id === id
              ? {
                  ...f,
                  title,
                  parentId: folderId,
                  deletedFromCoordinate: undefined,
                }
              : f,
          ),
        })
        return true
      },

      moveItemToDesktop: (id, preferCoordinate) => {
        const items = get().items
        const item = items.find((f) => f.id === id)
        if (!item || item.isDeleted) return false
        if (resolveParentId(item.parentId) == null) return false

        const title = uniqueSiblingTitle(items, item.kind, item.title, null, id)
        if (title !== item.title) {
          renameDesktopItemWindow(id, item.kind, title)
        }

        const occupied = Object.values(useDesktopStore.getState().coordinates)
        const coordinate = allocateDesktopCoordinate(
          occupied,
          preferCoordinate ?? item.deletedFromCoordinate ?? [4, 1],
        )
        useDesktopStore.getState().ensureCoordinate(id, coordinate)
        ensureWindowSlot(id)

        set({
          items: items.map((f) =>
            f.id === id
              ? {
                  ...f,
                  title,
                  parentId: null,
                }
              : f,
          ),
        })
        return true
      },

      moveToRecycleBin: (id) => {
        const items = get().items
        const item = items.find((f) => f.id === id)
        if (!item || item.isDeleted) return false

        const subtreeIds = [id, ...getDescendantIds(items, id)]
        const subtreeSet = new Set(subtreeIds)
        const now = Date.now()
        const coordinate =
          resolveParentId(item.parentId) == null
            ? useDesktopStore.getState().coordinates[id]
            : undefined

        for (const sid of subtreeIds) {
          removeDesktopItemWindow(sid)
          useDesktopStore.getState().removeCoordinate(sid)
        }

        set({
          items: items.map((f) => {
            if (!subtreeSet.has(f.id)) return f
            const isRoot = f.id === id
            return {
              ...f,
              isDeleted: true,
              deletedAt: now,
              deletedFromCoordinate: isRoot ? coordinate : f.deletedFromCoordinate,
            }
          }),
        })
        return true
      },

      restoreFromRecycleBin: (id) => {
        const items = get().items
        const item = items.find((f) => f.id === id)
        if (!item?.isDeleted) return false

        // 仅还原「回收站可见根」及其仍标记删除的后代
        const descendantIds = getDeletedDescendantIds(items, id)
        const restoreIds = new Set([id, ...descendantIds])

        // 父文件夹仍有效则还原进原父级，否则落到桌面
        let parentId = resolveParentId(item.parentId)
        if (parentId != null) {
          const parent = items.find((f) => f.id === parentId)
          if (!parent || parent.isDeleted || parent.kind !== 'folder') {
            parentId = null
          }
        }

        const rootTitle = uniqueSiblingTitle(items, item.kind, item.title, parentId, id)
        const onDesktop = parentId == null
        const occupied = Object.values(useDesktopStore.getState().coordinates)
        const coordinate = onDesktop
          ? allocateDesktopCoordinate(occupied, item.deletedFromCoordinate ?? [4, 1])
          : undefined

        const ok = registerItemWindow(
          { ...item, title: rootTitle, parentId },
          { title: rootTitle, coordinate, placeOnDesktop: onDesktop },
        )
        if (!ok) return false

        // 还原后代：保持相对 parentId，仅清删除标记
        for (const did of descendantIds) {
          const child = items.find((f) => f.id === did)
          if (!child) continue
          registerItemWindow(child, { placeOnDesktop: false })
        }

        set({
          items: get().items.map((f) => {
            if (!restoreIds.has(f.id)) return f
            if (f.id === id) {
              return {
                ...f,
                title: rootTitle,
                parentId,
                isDeleted: false,
                deletedAt: undefined,
                deletedFromCoordinate: undefined,
              }
            }
            return {
              ...f,
              isDeleted: false,
              deletedAt: undefined,
              deletedFromCoordinate: undefined,
            }
          }),
        })
        return true
      },

      purgeFromRecycleBin: async (id) => {
        const items = get().items
        const item = items.find((f) => f.id === id)
        if (!item?.isDeleted) return false

        const descendantIds = getDeletedDescendantIds(items, id)
        const purgeIds = new Set([id, ...descendantIds])
        const toDelete = items.filter((f) => purgeIds.has(f.id))

        for (const f of toDelete) {
          removeDesktopItemWindow(f.id)
          useDesktopStore.getState().removeCoordinate(f.id)
        }
        set({ items: items.filter((f) => !purgeIds.has(f.id)) })
        await Promise.all(toDelete.map((f) => deleteLinkedNote(f)))
        return true
      },

      emptyRecycleBin: async () => {
        const deleted = get().items.filter((f) => f.isDeleted)
        if (deleted.length === 0) return 0
        for (const f of deleted) {
          removeDesktopItemWindow(f.id)
          useDesktopStore.getState().removeCoordinate(f.id)
        }
        const removeIds = new Set(deleted.map((f) => f.id))
        set({ items: get().items.filter((f) => !removeIds.has(f.id)) })
        await Promise.all(deleted.map((f) => deleteLinkedNote(f)))
        return deleted.length
      },
    }),
    {
      name: STORAGE_KEYS.desktopItems,
      version: 5,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (state) => ({
        items: state.items,
      }),
      merge: (persisted, current) => {
        const saved = persisted as {
          items?: Array<Partial<DesktopItemRecord> & { id: string; title: string }>
          folders?: Array<Partial<DesktopItemRecord> & { id: string; title: string }>
        } | undefined

        const rawList = Array.isArray(saved?.items)
          ? saved!.items
          : Array.isArray(saved?.folders)
            ? saved!.folders.map((f) => ({ ...f, kind: 'folder' as const }))
            : []

        const items = rawList
          .map((f) => normalizeItem(f))
          .filter((f): f is DesktopItemRecord => f != null)

        return { ...current, items }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.items?.length) {
          restoreItemWindows(state.items)
        }
        state?.setHasHydrated(true)
      },
    },
  ),
)
