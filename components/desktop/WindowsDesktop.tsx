'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DesktopIconsLayer, useVisibleDesktopIcons } from './DesktopIconsLayer'
import { DesktopWindowsLayer } from './DesktopWindowsLayer'
import { DesktopTaskbar } from './DesktopTaskbar'
import { ContextMenu, modal, toast, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopWallpaper } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useDesktopStore } from '@/store/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import {
  CELL_STEP,
  pointerToCoordinate,
  sortIdsByCoordinate,
  type ArrangeAlign,
} from '@/lib/desktop'
import { promptRenameDesktopItem } from './promptRenameDesktopItem'

/**
 * 桌面编排：壁纸 + 图标层 + 窗口层 + 任务栏 + 右键菜单。
 * 各层自行订阅 store，彼此不互相 import。
 */
export function WindowsDesktop() {
  const td = useTranslations('desktop')
  const tApps = useTranslations('apps')
  const tRecycle = useTranslations('recycleBin')
  const tm = useTranslations('modal')
  const desktopBgStyle = useDesktopWallpaper()
  const openWindow = useWindowStore((s) => s.openWindow)
  const createFolder = useDesktopItemsStore((s) => s.createFolder)
  const createTextDocument = useDesktopItemsStore((s) => s.createTextDocument)
  const renameItem = useDesktopItemsStore((s) => s.renameItem)
  const moveToRecycleBin = useDesktopItemsStore((s) => s.moveToRecycleBin)
  const emptyRecycleBin = useDesktopItemsStore((s) => s.emptyRecycleBin)
  const deletedCount = useDesktopItemsStore((s) => s.items.filter((f) => f.isDeleted).length)
  const rearrangeIcons = useDesktopStore((s) => s.rearrangeIcons)
  const desktopIcons = useVisibleDesktopIcons()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const closeContextMenu = () => setContextMenu(null)

  const handleArrangeIcons = (container: HTMLElement, align: ArrangeAlign) => {
    if (desktopIcons.length === 0) return
    const maxRows = Math.max(4, Math.floor(container.clientHeight / CELL_STEP))
    const maxCols = Math.max(1, Math.floor(container.clientWidth / CELL_STEP))
    const ids = sortIdsByCoordinate(desktopIcons)
    rearrangeIcons(ids, { maxRows, maxCols, align })
  }

  const handleRenameItem = async (
    itemId: DesktopAppId,
    kind: 'folder' | 'textDocument',
    currentTitle: string,
  ) => {
    const item = useDesktopItemsStore.getState().items.find((i) => i.id === itemId)
    const next = await promptRenameDesktopItem({
      currentName: currentTitle,
      title: td('renameTitle'),
      itemId,
      kind,
      parentId: item?.parentId ?? null,
    })
    if (next == null || next === currentTitle.trim()) return
    await renameItem(itemId, next)
  }

  const handleEmptyRecycleBin = async () => {
    if (deletedCount === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: tRecycle('confirmEmpty', { count: deletedCount }),
    })
    if (!ok) return
    const n = await emptyRecycleBin()
    toast.success(tRecycle('emptied', { count: n }))
  }

  const handleCreateTextDocument = async (coordinate: ReturnType<typeof pointerToCoordinate> | null) => {
    const record = await createTextDocument({
      title: td('newTextDocumentName'),
      coordinate: coordinate ?? undefined,
    })
    if (!record) {
      toast.error(td('createTextDocumentFail'))
    }
  }

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as Element | null
    if (target?.closest?.('[data-window-id]')) return

    const iconEl = target?.closest?.('[data-desktop-icon]') as HTMLElement | null
    const iconId = (iconEl?.dataset.desktopIcon ?? null) as DesktopAppId | null
    const app = iconId ? desktopIcons.find((a) => a.id === iconId) : undefined
    const canOpen = Boolean(app?.app)
    const onBlank = !iconId
    const isUserItem = app?.kind === 'folder' || app?.kind === 'textDocument'
    const isRecycleBin = iconId === 'recycleBin'
    const desktopEl = e.currentTarget as HTMLElement
    const clickCoordinate = onBlank
      ? pointerToCoordinate(e.clientX, e.clientY, desktopEl)
      : null

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'open',
          label: td('open'),
          disabled: !canOpen,
          onSelect: () => {
            if (iconId && canOpen) openWindow(iconId)
          },
        },
        ...(isUserItem && iconId && app && (app.kind === 'folder' || app.kind === 'textDocument')
          ? [
              {
                id: 'rename',
                label: td('rename'),
                onSelect: () => {
                  const kind = app.kind
                  if (kind !== 'folder' && kind !== 'textDocument') return
                  void handleRenameItem(iconId, kind, resolveDesktopItemTitle(app, tApps))
                },
              },
              {
                id: 'delete',
                label: td('delete'),
                onSelect: () => {
                  moveToRecycleBin(iconId)
                },
              },
            ]
          : []),
        ...(isRecycleBin
          ? [
              {
                id: 'emptyRecycleBin',
                label: td('emptyRecycleBin'),
                disabled: deletedCount === 0,
                onSelect: () => {
                  void handleEmptyRecycleBin()
                },
              },
            ]
          : []),
        ...(onBlank
          ? [
              {
                id: 'new',
                label: td('new'),
                children: [
                  {
                    id: 'newFolder',
                    label: td('newFolder'),
                    onSelect: () => {
                      createFolder({
                        title: td('newFolderName'),
                        coordinate: clickCoordinate ?? undefined,
                      })
                    },
                  },
                  {
                    id: 'newTextDocument',
                    label: td('newTextDocument'),
                    onSelect: () => {
                      void handleCreateTextDocument(clickCoordinate)
                    },
                  },
                ],
              },
              {
                id: 'arrangeIcons',
                label: td('arrangeIcons'),
                children: [
                  {
                    id: 'arrangeLeft',
                    label: td('arrangeLeft'),
                    onSelect: () => {
                      handleArrangeIcons(desktopEl, 'left')
                    },
                  },
                  {
                    id: 'arrangeRight',
                    label: td('arrangeRight'),
                    onSelect: () => {
                      handleArrangeIcons(desktopEl, 'right')
                    },
                  },
                ],
              },
            ]
          : []),
        {
          id: 'refresh',
          label: td('refresh'),
          onSelect: () => {
            window.location.reload()
          },
        },
      ],
    })
  }

  return (
    <div className='min-h-screen flex flex-col select-none font-pixel text-on-desktop' style={desktopBgStyle}>
      <div className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem]' onContextMenu={handleDesktopContextMenu}>
        <DesktopIconsLayer />
        <DesktopWindowsLayer />
      </div>

      <DesktopTaskbar />
      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}
