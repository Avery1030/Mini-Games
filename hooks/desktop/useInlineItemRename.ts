'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DesktopAppId } from '@/config/desktop'
import { DBLCLICK_MS } from '@/lib/desktop'
import { isSiblingTitleTaken } from '@/lib/desktop/itemsTree'
import type { SelectionScope } from '@/store/desktopSelection'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { useDesktopItemsStore, type DesktopItemRecord } from '@/store/desktopItems'
import { toast } from '@/components/ui'

export type UseInlineItemRenameOptions = {
  /** 同级父目录；桌面根为 null */
  parentId: DesktopAppId | null
  scope: SelectionScope
  selectedIds: DesktopAppId[]
}

/**
 * 列表行内重命名：已单选再点文件名进入编辑；Enter / 失焦保存，Esc 取消。
 */
export function useInlineItemRename({ parentId, scope, selectedIds }: UseInlineItemRenameOptions) {
  const td = useTranslations('desktop')
  const items = useDesktopItemsStore((s) => s.items)
  const renameItem = useDesktopItemsStore((s) => s.renameItem)

  const [editingId, setEditingId] = useState<DesktopAppId | null>(null)
  const [editValue, setEditValue] = useState('')
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editCommitLockRef = useRef(false)
  const skipBlurCommitRef = useRef(false)
  const editValueRef = useRef('')
  const editingChildRef = useRef<DesktopItemRecord | null>(null)

  const clearRenameTimer = useCallback(() => {
    if (renameTimerRef.current) {
      clearTimeout(renameTimerRef.current)
      renameTimerRef.current = null
    }
  }, [])

  const startInlineRename = useCallback(
    (child: DesktopItemRecord) => {
      clearRenameTimer()
      skipBlurCommitRef.current = false
      editCommitLockRef.current = false
      editingChildRef.current = child
      editValueRef.current = child.title
      useDesktopSelectionStore.getState().selectOnly(child.id, scope)
      setEditingId(child.id)
      setEditValue(child.title)
    },
    [clearRenameTimer, scope],
  )

  const cancelInlineRename = useCallback(() => {
    clearRenameTimer()
    skipBlurCommitRef.current = true
    editingChildRef.current = null
    setEditingId(null)
    setEditValue('')
    editCommitLockRef.current = false
  }, [clearRenameTimer])

  const commitInlineRename = useCallback(
    async (child: DesktopItemRecord, raw: string) => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false
        return
      }
      if (editCommitLockRef.current) return
      editCommitLockRef.current = true
      const trimmed = raw.trim()
      if (!trimmed || trimmed === child.title.trim()) {
        cancelInlineRename()
        return
      }
      if (isSiblingTitleTaken(items, child.kind, trimmed, parentId, child.id)) {
        toast.error(td(child.kind === 'folder' ? 'renameDuplicate' : 'renameDuplicateText'))
        editCommitLockRef.current = false
        skipBlurCommitRef.current = false
        requestAnimationFrame(() => {
          editInputRef.current?.focus()
          editInputRef.current?.select()
        })
        return
      }
      const ok = await renameItem(child.id, trimmed)
      if (!ok) {
        toast.error(td(child.kind === 'folder' ? 'renameDuplicate' : 'renameDuplicateText'))
        editCommitLockRef.current = false
        skipBlurCommitRef.current = false
        requestAnimationFrame(() => {
          editInputRef.current?.focus()
          editInputRef.current?.select()
        })
        return
      }
      cancelInlineRename()
    },
    [cancelInlineRename, items, parentId, renameItem, td],
  )

  useEffect(() => {
    if (!editingId) return
    const el = editInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [editingId])

  useEffect(() => () => clearRenameTimer(), [clearRenameTimer])

  useEffect(() => {
    if (!editingId) return
    const onPointerDownCapture = (e: PointerEvent) => {
      const input = editInputRef.current
      if (!input) return
      if (e.target instanceof Node && (input === e.target || input.contains(e.target))) return
      const child = editingChildRef.current
      if (!child) return
      void commitInlineRename(child, editValueRef.current)
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [editingId, commitInlineRename])

  useEffect(() => {
    if (!editingId) return
    if (selectedIds.length === 1 && selectedIds[0] === editingId) return
    const child = editingChildRef.current
    if (child) void commitInlineRename(child, editValueRef.current)
    else cancelInlineRename()
  }, [selectedIds, editingId, commitInlineRename, cancelInlineRename])

  const scheduleRenameFromTitleClick = useCallback(
    (child: DesktopItemRecord) => {
      clearRenameTimer()
      renameTimerRef.current = setTimeout(() => {
        renameTimerRef.current = null
        startInlineRename(child)
      }, DBLCLICK_MS)
    },
    [clearRenameTimer, startInlineRename],
  )

  const handleTitleClick = useCallback(
    (
      child: DesktopItemRecord,
      e: React.MouseEvent,
      onItemClick: (child: DesktopItemRecord, e: React.MouseEvent) => void,
    ) => {
      e.stopPropagation()
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        onItemClick(child, e)
        return
      }
      const aloneSelected = selectedIds.length === 1 && selectedIds[0] === child.id
      if (!aloneSelected) {
        clearRenameTimer()
        useDesktopSelectionStore.getState().selectOnly(child.id, scope)
        return
      }
      scheduleRenameFromTitleClick(child)
    },
    [clearRenameTimer, scheduleRenameFromTitleClick, scope, selectedIds],
  )

  const setEditValueBoth = useCallback((value: string) => {
    editValueRef.current = value
    setEditValue(value)
  }, [])

  const commitEditing = useCallback(
    (child: DesktopItemRecord) => {
      void commitInlineRename(child, editValueRef.current)
    },
    [commitInlineRename],
  )

  return {
    editingId,
    editValue,
    editInputRef,
    startInlineRename,
    cancelInlineRename,
    commitInlineRename,
    commitEditing,
    clearRenameTimer,
    handleTitleClick,
    setEditValueBoth,
  }
}
