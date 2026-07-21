'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileText, Folder, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, ContextMenu, Panel, toast, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore, type DesktopItemRecord } from '@/store/desktopItems'
import { getChildren } from '@/lib/desktop/itemsTree'
import { useWindowStore } from '@/store/window'
import { promptRenameDesktopItem } from '@/components/desktop/promptRenameDesktopItem'

export type FolderAppProps = {
  embedded?: boolean
  folderTitle?: string
  folderId: DesktopAppId
}

/**
 * 文件夹窗口：展示子项树节点，支持打开 / 新建 / 移回桌面 / 删除。
 */
export function FolderApp({ embedded = false, folderTitle, folderId }: FolderAppProps) {
  const t = useTranslations('folder')
  const td = useTranslations('desktop')
  const items = useDesktopItemsStore((s) => s.items)
  const createFolder = useDesktopItemsStore((s) => s.createFolder)
  const createTextDocument = useDesktopItemsStore((s) => s.createTextDocument)
  const renameItem = useDesktopItemsStore((s) => s.renameItem)
  const moveItemToDesktop = useDesktopItemsStore((s) => s.moveItemToDesktop)
  const moveToRecycleBin = useDesktopItemsStore((s) => s.moveToRecycleBin)
  const openWindow = useWindowStore((s) => s.openWindow)

  const folderRecord = items.find((f) => f.id === folderId && f.kind === 'folder')
  const name = folderRecord?.title?.trim() || folderTitle?.trim() || t('untitled')

  const children = useMemo(
    () =>
      getChildren(items, folderId).slice().sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      }),
    [items, folderId],
  )

  const [selectedId, setSelectedId] = useState<DesktopAppId | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const selected = children.find((c) => c.id === selectedId) ?? null

  const openChild = (child: DesktopItemRecord) => {
    openWindow(child.id)
  }

  const handleRename = async (child: DesktopItemRecord) => {
    const next = await promptRenameDesktopItem({
      currentName: child.title,
      title: td('renameTitle'),
      itemId: child.id,
      kind: child.kind,
      parentId: folderId,
    })
    if (next == null || next === child.title.trim()) return
    const ok = await renameItem(child.id, next)
    if (!ok) toast.error(td(child.kind === 'folder' ? 'renameDuplicate' : 'renameDuplicateText'))
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

  const handleContextMenu = (e: React.MouseEvent, child?: DesktopItemRecord) => {
    e.preventDefault()
    e.stopPropagation()
    if (child) setSelectedId(child.id)

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: child
        ? [
            {
              id: 'open',
              label: td('open'),
              onSelect: () => openChild(child),
            },
            {
              id: 'rename',
              label: td('rename'),
              onSelect: () => {
                void handleRename(child)
              },
            },
            {
              id: 'toDesktop',
              label: t('moveToDesktop'),
              onSelect: () => {
                if (!moveItemToDesktop(child.id)) {
                  toast.warning(t('moveToDesktopFail'))
                }
              },
            },
            {
              id: 'delete',
              label: td('delete'),
              onSelect: () => {
                moveToRecycleBin(child.id)
                if (selectedId === child.id) setSelectedId(null)
              },
            },
          ]
        : [
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

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-0',
      )}
      onContextMenu={(e) => handleContextMenu(e)}
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
          disabled={!selected}
          onClick={() => selected && openChild(selected)}
        >
          {td('open')}
        </Button>
        <Button
          size='sm'
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            if (!moveItemToDesktop(selected.id)) toast.warning(t('moveToDesktopFail'))
          }}
        >
          {t('moveToDesktop')}
        </Button>
        <Button
          size='sm'
          disabled={!selected}
          onClick={() => {
            if (!selected) return
            moveToRecycleBin(selected.id)
            setSelectedId(null)
          }}
        >
          {td('delete')}
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

        <Panel inset className='flex-1 min-h-0 overflow-auto'>
          {children.length === 0 ? (
            <div className='h-full min-h-[8rem] flex items-center justify-center text-[11px] text-muted'>
              {t('empty')}
            </div>
          ) : (
            <ul className='divide-y divide-chrome-dark/40' role='listbox' aria-label={name}>
              {children.map((child) => {
                const active = selectedId === child.id
                const Icon = child.kind === 'folder' ? Folder : FileText
                return (
                  <li key={child.id}>
                    <button
                      type='button'
                      role='option'
                      aria-selected={active}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 text-left',
                        'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                        active && 'bg-icon-select text-icon-select-fg',
                      )}
                      onClick={() => setSelectedId(child.id)}
                      onDoubleClick={() => openChild(child)}
                      onContextMenu={(e) => handleContextMenu(e, child)}
                    >
                      <Icon size={16} strokeWidth={2} className='shrink-0' aria-hidden />
                      <span className='min-w-0 flex-1 truncate text-xs'>{child.title}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {t('status', { name, count: children.length })}
      </div>

      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
    </div>
  )
}
