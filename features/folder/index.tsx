'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, ContextMenu, Panel, toast, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore, type DesktopItemRecord } from '@/store/desktopItems'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { useFsDragStore } from '@/store/fsDrag'
import { getChildren } from '@/lib/desktop/itemsTree'
import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { useWindowStore } from '@/store/window'
import { useFsListSelection } from '@/hooks/desktop/useFsListSelection'
import { useInlineItemRename } from '@/hooks/desktop/useInlineItemRename'
import { FolderItemList, FS_LIST_GRAB_X, FS_LIST_GRAB_Y } from './FolderItemList'

export type FolderAppProps = {
  embedded?: boolean
  folderTitle?: string
  folderId: DesktopAppId
}

/**
 * 文件夹窗口：任意 folderId（桌面根文件夹 / 嵌套文件夹）共用同一套多选与行内重命名。
 */
export function FolderApp({ embedded = false, folderTitle, folderId }: FolderAppProps) {
  const t = useTranslations('folder')
  const td = useTranslations('desktop')
  const items = useDesktopItemsStore((s) => s.items)
  const createFolder = useDesktopItemsStore((s) => s.createFolder)
  const createTextDocument = useDesktopItemsStore((s) => s.createTextDocument)
  const moveItemsToDesktop = useDesktopItemsStore((s) => s.moveItemsToDesktop)
  const moveItemsToRecycleBin = useDesktopItemsStore((s) => s.moveItemsToRecycleBin)
  const openWindow = useWindowStore((s) => s.openWindow)

  const scope = useMemo(() => ({ type: 'folder' as const, folderId }), [folderId])

  const folderRecord = items.find((f) => f.id === folderId && f.kind === 'folder')
  const name = folderRecord?.title?.trim() || folderTitle?.trim() || t('untitled')

  const children = useMemo(
    () =>
      getChildren(items, folderId)
        .slice()
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        }),
    [items, folderId],
  )

  const orderedIds = useMemo(() => children.map((c) => c.id), [children])

  const handlePaste = useCallback(() => {
    void useDesktopSelectionStore
      .getState()
      .pasteInto(folderId)
      .then((ids) => {
        if (ids.length === 0) toast.warning(td('pasteFail'))
      })
  }, [folderId, td])

  const handleDelete = useCallback(() => {
    const ids = useDesktopSelectionStore.getState().selectedIds
    if (ids.length === 0) return
    moveItemsToRecycleBin(ids)
    useDesktopSelectionStore.getState().clear()
  }, [moveItemsToRecycleBin])

  const {
    selectedIds,
    clipboard,
    listRef,
    marqueeRect,
    ensureScope,
    handleItemClick,
    onListBlankPointerDown,
    singleSelected,
    hasSelection,
    MarqueeOverlay,
  } = useFsListSelection({
    scope,
    orderedIds,
    onDeleteSelection: () => handleDelete(),
    onPaste: handlePaste,
  })

  const {
    editingId,
    editValue,
    editInputRef,
    startInlineRename,
    cancelInlineRename,
    commitEditing,
    clearRenameTimer,
    handleTitleClick,
    setEditValueBoth,
  } = useInlineItemRename({ parentId: folderId, scope, selectedIds })

  const selected = useMemo(
    () => children.filter((c) => selectedIds.includes(c.id)),
    [children, selectedIds],
  )
  const primarySelected = selected[0] ?? null

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const openChild = (child: DesktopItemRecord) => {
    clearRenameTimer()
    cancelInlineRename()
    openWindow(child.id)
  }

  const handleCreateFolder = () => {
    createFolder({ title: td('newFolderName'), parentId: folderId })
  }

  const handleCreateText = async () => {
    const record = await createTextDocument({
      title: td('newTextDocumentName'),
      parentId: folderId,
    })
    if (!record) toast.error(td('createTextDocumentFail'))
  }

  const handleMoveToDesktop = () => {
    if (selectedIds.length === 0) return
    const moved = moveItemsToDesktop(selectedIds)
    if (moved.length === 0) toast.warning(t('moveToDesktopFail'))
    else useDesktopSelectionStore.getState().clear()
  }

  const handleItemPointerDown = (child: DesktopItemRecord, e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (editingId === child.id) return
    e.preventDefault()
    const ids = useDesktopSelectionStore.getState().prepareDragSelection(child.id, scope)
    useFsDragStore.getState().begin({
      primaryId: child.id,
      ids,
      pointerId: e.pointerId,
      offsetX: FS_LIST_GRAB_X,
      offsetY: FS_LIST_GRAB_Y,
      startX: e.clientX,
      startY: e.clientY,
      copy: e.altKey,
    })
  }

  const handleContextMenu = (e: React.MouseEvent, child?: DesktopItemRecord) => {
    e.preventDefault()
    e.stopPropagation()
    const sel = useDesktopSelectionStore.getState()
    if (child) {
      if (
        !(
          sel.scope.type === 'folder' &&
          sel.scope.folderId === folderId &&
          sel.selectedIds.includes(child.id)
        )
      ) {
        sel.selectOnly(child.id, scope)
      }
    }

    const selectionCount = (child ? useDesktopSelectionStore.getState().selectedIds : selectedIds)
      .length
    const hasSel = selectionCount > 0
    const singleSel = selectionCount === 1
    const canPaste = Boolean(clipboard?.ids.length)

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: child
        ? [
            {
              id: 'open',
              label: td('open'),
              disabled: !singleSel,
              onSelect: () => openChild(child),
            },
            {
              id: 'rename',
              label: td('rename'),
              disabled: !singleSel,
              onSelect: () => startInlineRename(child),
            },
            {
              id: 'copy',
              label: td('copy'),
              disabled: !hasSel,
              onSelect: () => {
                useDesktopSelectionStore.getState().copySelection()
              },
            },
            {
              id: 'cut',
              label: td('cut'),
              disabled: !hasSel,
              onSelect: () => {
                useDesktopSelectionStore.getState().cutSelection()
              },
            },
            {
              id: 'paste',
              label: td('paste'),
              disabled: !canPaste,
              onSelect: handlePaste,
            },
            {
              id: 'toDesktop',
              label: t('moveToDesktop'),
              onSelect: handleMoveToDesktop,
            },
            {
              id: 'delete',
              label: td('delete'),
              onSelect: handleDelete,
            },
          ]
        : [
            {
              id: 'paste',
              label: td('paste'),
              disabled: !canPaste,
              onSelect: handlePaste,
            },
            {
              id: 'new',
              label: td('new'),
              children: [
                {
                  id: 'newFolder',
                  label: td('newFolder'),
                  onSelect: handleCreateFolder,
                },
                {
                  id: 'newTextDocument',
                  label: td('newTextDocument'),
                  onSelect: () => {
                    void handleCreateText()
                  },
                },
              ],
            },
          ],
    })
  }

  const statusText =
    selectedIds.length > 1
      ? td('selectCount', { count: selectedIds.length })
      : t('status', { name, count: children.length })

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-0',
      )}
      onContextMenu={(e) => handleContextMenu(e)}
      onPointerDown={ensureScope}
    >
      <div className='shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-chrome-dark bg-chrome'>
        <Button size='sm' onClick={handleCreateFolder}>
          {t('newFolder')}
        </Button>
        <Button size='sm' onClick={() => void handleCreateText()}>
          {t('newTextDocument')}
        </Button>
        <Button
          size='sm'
          disabled={!primarySelected || !singleSelected}
          onClick={() => primarySelected && openChild(primarySelected)}
        >
          {td('open')}
        </Button>
        <Button size='sm' disabled={!hasSelection} onClick={handleMoveToDesktop}>
          {t('moveToDesktop')}
        </Button>
        <Button size='sm' disabled={!hasSelection} onClick={handleDelete}>
          {td('delete')}
        </Button>
        <Button size='sm' disabled={!clipboard?.ids.length} onClick={handlePaste}>
          {td('paste')}
        </Button>
      </div>

      <div className={cn('flex-1 min-h-0 flex flex-col gap-2 overflow-hidden', embedded ? 'p-3' : 'p-2')}>
        <div className='shrink-0 flex items-center gap-2'>
          <FolderOpen size={18} strokeWidth={2} className='shrink-0 text-muted' aria-hidden />
          <div className='min-w-0'>
            <h2 className='text-base font-bold truncate'>{name}</h2>
            <p className='text-[11px] text-muted mt-0.5'>{t('hint')}</p>
          </div>
        </div>

        <Panel inset className='flex-1 min-h-0 overflow-auto' data-fs-drop={`folder:${folderId}`}>
          <FolderItemList
            listRef={listRef}
            folderId={folderId}
            listLabel={name}
            emptyText={t('empty')}
            items={children}
            selectedIds={selectedIds}
            editingId={editingId}
            editValue={editValue}
            editInputRef={editInputRef}
            onListBlankPointerDown={onListBlankPointerDown}
            onEnsureScope={ensureScope}
            onItemClick={(child, e) => {
              if (editingId === child.id) return
              clearRenameTimer()
              handleItemClick(child.id, e)
            }}
            onTitleClick={(child, e) =>
              handleTitleClick(child, e, (c, ev) => handleItemClick(c.id, ev))
            }
            onOpen={openChild}
            onItemPointerDown={handleItemPointerDown}
            onContextMenu={handleContextMenu}
            onEditValueChange={setEditValueBoth}
            onCommitEdit={commitEditing}
            onCancelEdit={cancelInlineRename}
            onClearRenameTimer={clearRenameTimer}
          />
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {statusText}
      </div>

      <MarqueeOverlay rect={marqueeRect} />
      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} safeBottom={TASKBAR_H} />
    </div>
  )
}
