'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { DesktopAppId } from '@/config/desktop'
import {
  EMPTY_SELECTION_IDS,
  useDesktopSelectionStore,
  type SelectionScope,
} from '@/store/desktopSelection'
import { MarqueeOverlay, useMarqueeSelect } from '@/hooks/desktop/useMarqueeSelect'

function scopeMatches(a: SelectionScope, b: SelectionScope): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'folder' && b.type === 'folder') return a.folderId === b.folderId
  return true
}

export type UseFsListSelectionOptions = {
  scope: SelectionScope
  orderedIds: DesktopAppId[]
  /** 删除选中项（Delete / Backspace） */
  onDeleteSelection?: (ids: DesktopAppId[]) => void
  /** 粘贴到当前容器 */
  onPaste?: () => void
  /** 是否启用 Ctrl/⌘+C/X/V（回收站可关） */
  enableClipboardShortcuts?: boolean
}

/**
 * 文件系统列表通用多选：Ctrl/⌘ 切换、Shift 范围、框选、快捷键。
 * 桌面文件夹 / 嵌套文件夹 / 回收站均可复用。
 */
export function useFsListSelection({
  scope,
  orderedIds,
  onDeleteSelection,
  onPaste,
  enableClipboardShortcuts = true,
}: UseFsListSelectionOptions) {
  const selectedIds = useDesktopSelectionStore((s) =>
    scopeMatches(s.scope, scope) ? s.selectedIds : EMPTY_SELECTION_IDS,
  )
  const clipboard = useDesktopSelectionStore((s) => s.clipboard)

  const listRef = useRef<HTMLDivElement>(null)
  const orderedIdsRef = useRef(orderedIds)
  orderedIdsRef.current = orderedIds
  const onDeleteRef = useRef(onDeleteSelection)
  onDeleteRef.current = onDeleteSelection
  const onPasteRef = useRef(onPaste)
  onPasteRef.current = onPaste

  const ensureScope = useCallback(() => {
    useDesktopSelectionStore.getState().ensureScope(scope)
  }, [scope])

  const clearSelection = useCallback(() => {
    useDesktopSelectionStore.getState().clear()
  }, [])

  const handleItemClick = useCallback(
    (id: DesktopAppId, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
      const sel = useDesktopSelectionStore.getState()
      sel.ensureScope(scope)
      if (e.shiftKey) {
        sel.selectRange(orderedIdsRef.current, id, scope)
        return
      }
      if (e.metaKey || e.ctrlKey) {
        sel.toggle(id, scope)
        return
      }
      sel.selectOnly(id, scope)
    },
    [scope],
  )

  const { marqueeRect, handleBlankPointerDown } = useMarqueeSelect({
    selectableIds: orderedIds,
    scopeRoot: listRef,
    onSelect: (ids) => {
      useDesktopSelectionStore.getState().setSelection(ids, scope)
    },
    onClear: clearSelection,
  })

  const onListBlankPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ensureScope()
      handleBlankPointerDown(
        e,
        selectedIds.filter((id) => orderedIdsRef.current.includes(id)),
      )
    },
    [ensureScope, handleBlankPointerDown, selectedIds],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const cur = useDesktopSelectionStore.getState()
      if (!scopeMatches(cur.scope, scope)) return
      const meta = e.metaKey || e.ctrlKey
      if (!meta) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (cur.selectedIds.length === 0 || !onDeleteRef.current) return
          e.preventDefault()
          onDeleteRef.current(cur.selectedIds)
        }
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        cur.setSelection(orderedIdsRef.current, scope)
        return
      }
      if (!enableClipboardShortcuts) return
      if (key === 'c') {
        e.preventDefault()
        cur.copySelection()
        return
      }
      if (key === 'x') {
        e.preventDefault()
        cur.cutSelection()
        return
      }
      if (key === 'v') {
        e.preventDefault()
        onPasteRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [scope, enableClipboardShortcuts])

  const singleSelected = selectedIds.length === 1
  const hasSelection = selectedIds.length > 0

  return {
    selectedIds,
    clipboard,
    listRef,
    marqueeRect,
    ensureScope,
    clearSelection,
    handleItemClick,
    onListBlankPointerDown,
    singleSelected,
    hasSelection,
    MarqueeOverlay,
  }
}
