'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { DesktopIconsLayer, useVisibleDesktopIcons } from './DesktopIconsLayer'
import { DesktopWindowsLayer } from './DesktopWindowsLayer'
import { DesktopTaskbar } from './DesktopTaskbar'
import { ContextMenu, modal, toast, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopWallpaper } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useDesktopStore } from '@/store/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { useDesktopSelectionStore } from '@/store/desktopSelection'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import {
  CELL_STEP,
  pointerToCoordinate,
  sortIdsByCoordinate,
  type ArrangeAlign,
} from '@/lib/desktop'
import { promptRenameDesktopItem } from './promptRenameDesktopItem'
import { FsDragLayer } from './FsDragLayer'
import { Desktop3DWallpaper } from './Desktop3DWallpaper'
import { buildDesktopContextMenu } from './buildDesktopContextMenu'
import { useSettingsStore } from '@/store/settings'
import { TRASH_PATH, vfs } from '@/lib/vfs'
import { isVfsDesktopFileId, useDesktopVfsStore } from '@/store/desktopVfs'
import { openVfsFile } from '@/lib/desktop/openVfsFile'

/**
 * 桌面编排：壁纸 + 图标层 + 窗口层 + 任务栏 + 右键菜单。
 * 各层自行订阅 store，彼此不互相 import。
 */
export function WindowsDesktop() {
  const td = useTranslations('desktop')
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const tRecycle = useTranslations('recycleBin')
  const tm = useTranslations('modal')
  const desktopBgStyle = useDesktopWallpaper()
  const wallpaper3dEnabled = useSettingsStore((s) => s.wallpaper3dEnabled)
  const wallpaper3dPath = useSettingsStore((s) => s.wallpaper3dPath)
  const openWindow = useWindowStore((s) => s.openWindow)
  const createFolder = useDesktopItemsStore((s) => s.createFolder)
  const createTextDocument = useDesktopItemsStore((s) => s.createTextDocument)
  const renameItem = useDesktopItemsStore((s) => s.renameItem)
  const moveItemsToRecycleBin = useDesktopItemsStore((s) => s.moveItemsToRecycleBin)
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
    let vfsCount = 0
    try {
      vfsCount = (await vfs.readDir(TRASH_PATH)).length
    } catch {
      vfsCount = 0
    }
    const total = deletedCount + vfsCount
    if (total === 0) {
      toast.warning(tRecycle('emptyList'))
      return
    }
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: tRecycle('confirmEmpty', { count: total }),
    })
    if (!ok) return
    const n = await emptyRecycleBin()
    try {
      await vfs.clearTrash()
    } catch {
      // 桌面项已清空时仍尽量完成
    }
    toast.success(tRecycle('emptied', { count: n + vfsCount }))
  }

  const handleCreateTextDocument = async (
    coordinate: ReturnType<typeof pointerToCoordinate> | null,
  ) => {
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
    const onBlank = !iconId
    const isVfsFile = Boolean(iconId && isVfsDesktopFileId(iconId))
    const isUserItem = app?.kind === 'folder' || app?.kind === 'textDocument' || isVfsFile
    const isRecycleBin = iconId === 'recycleBin'
    const canOpen = Boolean(app?.app) || isVfsFile
    const desktopEl = e.currentTarget as HTMLElement
    const clickCoordinate = pointerToCoordinate(e.clientX, e.clientY, desktopEl)

    const selStore = useDesktopSelectionStore.getState()
    if (isUserItem && iconId) {
      if (!(selStore.scope.type === 'desktop' && selStore.selectedIds.includes(iconId))) {
        selStore.selectOnly(iconId, { type: 'desktop' })
      }
    }

    const sel = useDesktopSelectionStore.getState()
    const selectedUserIds =
      sel.scope.type === 'desktop'
        ? sel.selectedIds.filter((id) => {
            if (isVfsDesktopFileId(id)) return true
            const a = desktopIcons.find((x) => x.id === id)
            return a?.kind === 'folder' || a?.kind === 'textDocument'
          })
        : []

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: buildDesktopContextMenu({
        iconId,
        app,
        onBlank,
        isUserItem,
        isRecycleBin,
        canOpen,
        hasUserSelection: selectedUserIds.length > 0,
        singleUserSelection: selectedUserIds.length === 1,
        canPaste: Boolean(sel.clipboard?.ids.length),
        deletedCount,
        clickCoordinate,
        desktopEl,
        labels: {
          open: td('open'),
          rename: td('rename'),
          copy: td('copy'),
          cut: td('cut'),
          delete: td('delete'),
          paste: td('paste'),
          new: td('new'),
          newFolder: td('newFolder'),
          newTextDocument: td('newTextDocument'),
          emptyRecycleBin: td('emptyRecycleBin'),
          arrangeIcons: td('arrangeIcons'),
          arrangeLeft: td('arrangeLeft'),
          arrangeRight: td('arrangeRight'),
          refresh: td('refresh'),
        },
        actions: {
          open: () => {
            if (!iconId || !canOpen) return
            if (isVfsDesktopFileId(iconId)) {
              void openVfsFile(iconId).then((kind) => {
                if (kind === 'unsupported') toast.warning(td('cannotOpenVfsFile'))
              })
              return
            }
            openWindow(iconId)
          },
          rename: () => {
            if (!iconId || !app || (app.kind !== 'folder' && app.kind !== 'textDocument')) return
            void handleRenameItem(iconId, app.kind, resolveDesktopItemTitle(app, tApps, locale))
          },
          copy: () => {
            useDesktopSelectionStore.getState().copySelection()
          },
          cut: () => {
            useDesktopSelectionStore.getState().cutSelection()
          },
          delete: () => {
            if (!iconId) return
            const ids =
              useDesktopSelectionStore.getState().scope.type === 'desktop' &&
              useDesktopSelectionStore.getState().selectedIds.length > 0
                ? useDesktopSelectionStore.getState().selectedIds
                : [iconId]
            const vfsIds = ids.filter((id) => isVfsDesktopFileId(id))
            const itemIds = ids.filter((id) => !isVfsDesktopFileId(id))
            if (vfsIds.length > 0) {
              void (async () => {
                for (const path of vfsIds) {
                  try {
                    await vfs.trash(path)
                  } catch {
                    // ignore
                  }
                }
                await useDesktopVfsStore.getState().refresh()
              })()
            }
            if (itemIds.length > 0) moveItemsToRecycleBin(itemIds)
            useDesktopSelectionStore.getState().clear()
          },
          paste: () => {
            void useDesktopSelectionStore
              .getState()
              .pasteInto(null)
              .then((ids) => {
                if (ids.length === 0) toast.warning(td('pasteFail'))
              })
          },
          createFolder: () => {
            createFolder({
              title: td('newFolderName'),
              coordinate: clickCoordinate,
            })
          },
          createTextDocument: () => {
            void handleCreateTextDocument(clickCoordinate)
          },
          emptyRecycleBin: () => {
            void handleEmptyRecycleBin()
          },
          arrangeLeft: () => {
            handleArrangeIcons(desktopEl, 'left')
          },
          arrangeRight: () => {
            handleArrangeIcons(desktopEl, 'right')
          },
          refresh: () => {
            window.location.reload()
          },
        },
      }),
    })
  }

  return (
    <div className='min-h-screen flex flex-col select-none font-pixel text-on-desktop' style={desktopBgStyle}>
      <div
        className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem]'
        onContextMenu={handleDesktopContextMenu}
      >
        {wallpaper3dEnabled && wallpaper3dPath ? (
          <Desktop3DWallpaper path={wallpaper3dPath} enabled />
        ) : null}
        <DesktopIconsLayer />
        <DesktopWindowsLayer />
        <FsDragLayer />
      </div>

      <DesktopTaskbar />
      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}
