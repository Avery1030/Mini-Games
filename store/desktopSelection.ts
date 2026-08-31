import { create } from 'zustand'
import type { DesktopAppId } from '@/config/desktop'
import { filterSelectionRoots } from '@/lib/desktop/itemsTree'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { isVfsDesktopFileId } from '@/store/desktopVfs'

/** Selector 回退用稳定空数组，避免每次返回新 `[]` 触发无限重渲染 */
export const EMPTY_SELECTION_IDS: DesktopAppId[] = []

export type SelectionScope =
  | { type: 'desktop' }
  | { type: 'folder'; folderId: DesktopAppId }
  | { type: 'recycleBin' }

export type FsClipboard = {
  mode: 'copy' | 'cut'
  ids: DesktopAppId[]
}

type DesktopSelectionState = {
  selectedIds: DesktopAppId[]
  anchorId: Nullable<DesktopAppId>
  scope: SelectionScope
  clipboard: Nullable<FsClipboard>
}

type DesktopSelectionActions = {
  ensureScope: (scope: SelectionScope) => void
  clear: () => void
  selectOnly: (id: DesktopAppId, scope: SelectionScope) => void
  toggle: (id: DesktopAppId, scope: SelectionScope) => void
  selectRange: (orderedIds: DesktopAppId[], toId: DesktopAppId, scope: SelectionScope) => void
  /** 点击项时：若已在选区则保留多选；否则改为单选 */
  prepareDragSelection: (id: DesktopAppId, scope: SelectionScope) => DesktopAppId[]
  setSelection: (ids: DesktopAppId[], scope: SelectionScope, anchorId?: Nullable<DesktopAppId>) => void
  copySelection: () => boolean
  cutSelection: () => boolean
  pasteInto: (parentId: Nullable<DesktopAppId>) => Promise<DesktopAppId[]>
  isSelected: (id: DesktopAppId) => boolean
}

export type DesktopSelectionStore = DesktopSelectionState & DesktopSelectionActions

function sameScope(a: SelectionScope, b: SelectionScope): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'folder' && b.type === 'folder') return a.folderId === b.folderId
  return true
}

export const useDesktopSelectionStore = create<DesktopSelectionStore>()((set, get) => ({
  selectedIds: [],
  anchorId: null,
  scope: { type: 'desktop' },
  clipboard: null,

  ensureScope: (scope) => {
    const cur = get().scope
    if (!sameScope(cur, scope)) {
      set({ scope, selectedIds: [], anchorId: null })
    }
  },

  clear: () => set({ selectedIds: [], anchorId: null }),

  selectOnly: (id, scope) => {
    set({ scope, selectedIds: [id], anchorId: id })
  },

  toggle: (id, scope) => {
    const state = get()
    if (!sameScope(state.scope, scope)) {
      set({ scope, selectedIds: [id], anchorId: id })
      return
    }
    const has = state.selectedIds.includes(id)
    const selectedIds = has ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id]
    set({
      selectedIds,
      anchorId: id,
    })
  },

  selectRange: (orderedIds, toId, scope) => {
    const state = get()
    if (!sameScope(state.scope, scope)) {
      set({ scope, selectedIds: [toId], anchorId: toId })
      return
    }
    const anchor = state.anchorId && orderedIds.includes(state.anchorId) ? state.anchorId : toId
    const a = orderedIds.indexOf(anchor)
    const b = orderedIds.indexOf(toId)
    if (a < 0 || b < 0) {
      set({ selectedIds: [toId], anchorId: toId, scope })
      return
    }
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    set({
      scope,
      selectedIds: orderedIds.slice(lo, hi + 1),
      anchorId: anchor,
    })
  },

  prepareDragSelection: (id, scope) => {
    const state = get()
    // 不在此改写选区：单击修饰键由 onItemClick 处理；拖拽开始后再 setSelection
    if (sameScope(state.scope, scope) && state.selectedIds.includes(id)) {
      return state.selectedIds.slice()
    }
    return [id]
  },

  setSelection: (ids, scope, anchorId) => {
    set({
      scope,
      selectedIds: [...new Set(ids)],
      anchorId: anchorId === undefined ? (ids[0] ?? null) : anchorId,
    })
  },

  copySelection: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return false
    const items = useDesktopItemsStore.getState().items
    const itemRoots = filterSelectionRoots(items, selectedIds)
    const vfsIds = selectedIds.filter((id) => isVfsDesktopFileId(id))
    const ids = [...new Set([...itemRoots, ...vfsIds])]
    if (ids.length === 0) return false
    set({ clipboard: { mode: 'copy', ids } })
    return true
  },

  cutSelection: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return false
    const items = useDesktopItemsStore.getState().items
    const itemRoots = filterSelectionRoots(items, selectedIds)
    const vfsIds = selectedIds.filter((id) => isVfsDesktopFileId(id))
    const ids = [...new Set([...itemRoots, ...vfsIds])]
    if (ids.length === 0) return false
    set({ clipboard: { mode: 'cut', ids } })
    return true
  },

  pasteInto: async (parentId) => {
    const clip = get().clipboard
    if (!clip || clip.ids.length === 0) return []

    const vfsIds = clip.ids.filter((id) => isVfsDesktopFileId(id))
    const itemIds = clip.ids.filter((id) => !isVfsDesktopFileId(id))
    const store = useDesktopItemsStore.getState()

    if (parentId != null) {
      if (itemIds.length === 0) return []
      if (clip.mode === 'copy') return store.copyItems(itemIds, parentId)
      const moved = store.moveItemsIntoFolder(itemIds, parentId)
      if (moved.length > 0) set({ clipboard: null })
      return moved
    }

    const created: DesktopAppId[] = []
    if (clip.mode === 'copy') {
      if (itemIds.length > 0) created.push(...(await store.copyItems(itemIds, null)))
      if (vfsIds.length > 0) {
        const { duplicateDesktopVfsFiles } = await import('@/lib/desktop/vfsFileActions')
        created.push(...(await duplicateDesktopVfsFiles(vfsIds)))
      }
      return created
    }

    if (itemIds.length > 0) created.push(...store.moveItemsToDesktop(itemIds))
    if (created.length > 0 || vfsIds.length > 0) set({ clipboard: null })
    return created.length > 0 ? created : vfsIds
  },

  isSelected: (id) => get().selectedIds.includes(id),
}))
