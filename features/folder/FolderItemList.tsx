'use client'

import { useMemo } from 'react'
import { FileText, Folder } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Input } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import type { DesktopItemRecord } from '@/store/desktopItems'
import { EMPTY_SELECTION_IDS } from '@/store/desktopSelection'
import { useFsDragStore } from '@/store/fsDrag'

/** 列表项拖出时幽灵相对指针的抓取点 */
export const FS_LIST_GRAB_X = 18
export const FS_LIST_GRAB_Y = 14

export type FolderItemListProps = {
  listRef: React.RefObject<HTMLDivElement | null>
  folderId: DesktopAppId
  listLabel: string
  emptyText: string
  items: DesktopItemRecord[]
  selectedIds: DesktopAppId[]
  editingId: DesktopAppId | null
  editValue: string
  editInputRef: React.RefObject<HTMLInputElement | null>
  onListBlankPointerDown: (e: React.PointerEvent) => void
  onEnsureScope: () => void
  onItemClick: (child: DesktopItemRecord, e: React.MouseEvent) => void
  onTitleClick: (child: DesktopItemRecord, e: React.MouseEvent) => void
  onOpen: (child: DesktopItemRecord) => void
  onItemPointerDown: (child: DesktopItemRecord, e: React.PointerEvent) => void
  onContextMenu: (e: React.MouseEvent, child?: DesktopItemRecord) => void
  onEditValueChange: (value: string) => void
  onCommitEdit: (child: DesktopItemRecord) => void
  onCancelEdit: () => void
  onClearRenameTimer: () => void
}

/**
 * 文件夹内容列表：多选高亮、拖出、行内重命名。任意 folderId 共用。
 */
export function FolderItemList({
  listRef,
  folderId,
  listLabel,
  emptyText,
  items,
  selectedIds,
  editingId,
  editValue,
  editInputRef,
  onListBlankPointerDown,
  onEnsureScope,
  onItemClick,
  onTitleClick,
  onOpen,
  onItemPointerDown,
  onContextMenu,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onClearRenameTimer,
}: FolderItemListProps) {
  const td = useTranslations('desktop')
  const fsDraggingIds = useFsDragStore((s) =>
    s.session?.moved ? s.session.ids : EMPTY_SELECTION_IDS,
  )

  const dropAttr = useMemo(() => `folder:${folderId}`, [folderId])

  return (
    <div
      ref={listRef}
      className='min-h-full'
      data-fs-drop={dropAttr}
      onPointerDown={(e) => {
        onEnsureScope()
        onListBlankPointerDown(e)
      }}
    >
      {items.length === 0 ? (
        <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
          {emptyText}
        </div>
      ) : (
        <ul
          className='divide-y divide-chrome-dark/40 min-h-full'
          role='listbox'
          aria-label={listLabel}
          aria-multiselectable
        >
          {items.map((child) => {
            const active = selectedIds.includes(child.id)
            const Icon = child.kind === 'folder' ? Folder : FileText
            const isDragging = fsDraggingIds.includes(child.id)
            const isEditing = editingId === child.id
            const rowClass = cn(
              'w-full flex items-center gap-2 px-2 py-1.5 text-left',
              'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
              active && 'bg-icon-select text-icon-select-fg',
              isDragging && 'opacity-40',
            )

            if (isEditing) {
              return (
                <li key={child.id}>
                  <div
                    role='option'
                    aria-selected
                    data-desktop-icon={child.id}
                    data-fs-kind={child.kind}
                    className={rowClass}
                  >
                    <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                    <Input
                      ref={editInputRef}
                      type='text'
                      size='sm'
                      tone='field'
                      autoComplete='off'
                      value={editValue}
                      aria-label={td('renameLabel')}
                      className='min-w-0 flex-1 h-6 text-xs'
                      onChange={(e) => onEditValueChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onBlur={() => onCommitEdit(child)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          onCommitEdit(child)
                        } else if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          onCancelEdit()
                        }
                      }}
                    />
                  </div>
                </li>
              )
            }

            return (
              <li key={child.id}>
                <button
                  type='button'
                  role='option'
                  aria-selected={active}
                  data-desktop-icon={child.id}
                  data-fs-kind={child.kind}
                  className={rowClass}
                  onClick={(e) => onItemClick(child, e)}
                  onDoubleClick={() => onOpen(child)}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onItemPointerDown(child, e)
                  }}
                  onContextMenu={(e) => onContextMenu(e, child)}
                >
                  <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                  <span
                    className='min-w-0 flex-1 truncate text-xs'
                    onClick={(e) => onTitleClick(child, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onClearRenameTimer()
                      onOpen(child)
                    }}
                  >
                    {child.title}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
