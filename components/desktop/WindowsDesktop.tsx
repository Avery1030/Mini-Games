'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DesktopIconsLayer, useVisibleDesktopIcons } from './DesktopIconsLayer'
import { DesktopWindowsLayer } from './DesktopWindowsLayer'
import { DesktopTaskbar } from './DesktopTaskbar'
import { ContextMenu, type ContextMenuState } from '@/components/ui'
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
import { promptRenameFolder } from './promptRenameFolder'

/**
 * 桌面编排：壁纸 + 图标层 + 窗口层 + 任务栏 + 右键菜单。
 * 各层自行订阅 store，彼此不互相 import。
 */
export function WindowsDesktop() {
  const td = useTranslations('desktop')
  const tApps = useTranslations('apps')
  const desktopBgStyle = useDesktopWallpaper()
  const openWindow = useWindowStore((s) => s.openWindow)
  const createFolder = useDesktopItemsStore((s) => s.createFolder)
  const renameFolder = useDesktopItemsStore((s) => s.renameFolder)
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

  const handleRenameFolder = async (folderId: DesktopAppId, currentTitle: string) => {
    const next = await promptRenameFolder({
      currentName: currentTitle,
      title: td('renameTitle'),
      folderId,
    })
    if (next == null || next === currentTitle.trim()) return
    renameFolder(folderId, next)
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
    const isFolder = app?.kind === 'folder'
    // 在事件回调内立刻换算，避免 onSelect 时 currentTarget 失效
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
        ...(isFolder && iconId && app
          ? [
              {
                id: 'rename',
                label: td('rename'),
                onSelect: () => {
                  void handleRenameFolder(iconId, resolveDesktopItemTitle(app, tApps))
                },
              },
            ]
          : []),
        ...(onBlank
          ? [
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
        {/* grid 放在无 padding 的内层，absolute 让位时与 grid 原点一致 */}
        <DesktopIconsLayer />
        <DesktopWindowsLayer />
      </div>

      <DesktopTaskbar />
      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}
