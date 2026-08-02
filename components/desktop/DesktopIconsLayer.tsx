'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { File, FileText, Image as ImageIcon } from 'lucide-react'
import { DesktopIcon, ICON_VIS } from './DesktopIcon'
import { DesktopDragGhost } from './DesktopDragGhost'
import { useDesktopApps, useDesktopHydrated, useDesktopIconDrag, useMarqueeSelect, MarqueeOverlay } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { EMPTY_SELECTION_IDS, useDesktopSelectionStore } from '@/store/desktopSelection'
import { isDesktopRootItem, sortIdsByCoordinate } from '@/lib/desktop'
import { CELL_GAP, CELL_SIZE, coordinateToPosition, resolveCoordinate } from '@/lib/desktop'
import { resolveDesktopItemTitle, allocateDesktopCoordinate } from '@/lib/desktop/window'
import { scalePx } from '@/lib/uiScale'
import { toast } from '@/components/ui'
import type { DesktopAppId, DesktopAppView, DesktopCoordinate } from '@/config/desktop'
import { DEFAULT_WINDOW_RUNTIME } from '@/config/desktop'
import { isImagePath } from '@/features/image-viewer/api'
import { openVfsFile } from '@/lib/desktop/openVfsFile'
import { getExtension, vfs, type FileNode } from '@/lib/vfs'
import { isVfsDesktopFileId, useDesktopVfsStore } from '@/store/desktopVfs'

function vfsFileIcon(node: FileNode) {
  if (isImagePath(node.path)) return ImageIcon
  if (getExtension(node.path).toLowerCase() === 'txt') return FileText
  return File
}

function useRootDesktopIcons(): DesktopAppView[] {
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)
  const items = useDesktopItemsStore((s) => s.items)

  return useMemo(() => {
    if (!hasHydrated) return []
    const byId = new Map(items.map((i) => [i.id, i]))
    let list = apps.filter((app) => {
      if (app.showOnDesktop === false) return false
      const item = byId.get(app.id)
      if (!item) return true
      return isDesktopRootItem(item)
    })
    if (hidePlaceholderIcons) {
      list = list.filter((app) => app.app != null)
    }
    return list
  }, [apps, hasHydrated, hidePlaceholderIcons, items])
}

function useVfsDesktopIconViews(): DesktopAppView[] {
  const files = useDesktopVfsStore((s) => s.files)
  const coordinates = useDesktopStore((s) => s.coordinates)

  useEffect(() => {
    const store = useDesktopStore.getState()
    const occupied = Object.values(store.coordinates)
    let prefer: DesktopCoordinate = [5, 1]
    for (const file of files) {
      if (store.coordinates[file.path]) continue
      const coord = allocateDesktopCoordinate(occupied, prefer)
      store.ensureCoordinate(file.path, coord)
      occupied.push(coord)
      prefer = coord
    }
  }, [files])

  return useMemo(() => {
    return files.map((file) => {
      const Icon = vfsFileIcon(file)
      return {
        id: file.path,
        icon: Icon,
        defaultCoordinate: (coordinates[file.path] ?? [5, 1]) as DesktopCoordinate,
        title: file.name,
        width: 0,
        height: 0,
        ...DEFAULT_WINDOW_RUNTIME,
        coordinate: (coordinates[file.path] ?? [5, 1]) as DesktopCoordinate,
      } satisfies DesktopAppView
    })
  }, [coordinates, files])
}

/**
 * 桌面图标网格 + 多选拖拽 + 框选。自行订阅 store。
 */
export function DesktopIconsLayer() {
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const td = useTranslations('desktop')
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)
  const moveItemsToRecycleBin = useDesktopItemsStore((s) => s.moveItemsToRecycleBin)
  const moveItemsIntoFolder = useDesktopItemsStore((s) => s.moveItemsIntoFolder)
  const copyItems = useDesktopItemsStore((s) => s.copyItems)
  const moveItemsToDesktop = useDesktopItemsStore((s) => s.moveItemsToDesktop)
  const items = useDesktopItemsStore((s) => s.items)
  const refreshDesktopVfs = useDesktopVfsStore((s) => s.refresh)
  const selectedIds = useDesktopSelectionStore((s) =>
    s.scope.type === 'desktop' ? s.selectedIds : EMPTY_SELECTION_IDS,
  )
  const { showIconLabels, iconSize, uiScale } = useSettingsStore(
    useShallow((s) => ({
      showIconLabels: s.showIconLabels,
      iconSize: s.iconSize,
      uiScale: s.uiScale,
    })),
  )

  const desktopRef = useRef<HTMLDivElement>(null)
  const appIcons = useRootDesktopIcons()
  const vfsIcons = useVfsDesktopIconViews()
  const desktopIcons = useMemo(() => [...appIcons, ...vfsIcons], [appIcons, vfsIcons])
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    void refreshDesktopVfs()
  }, [refreshDesktopVfs])

  const orderedUserIds = useMemo(() => {
    const user = desktopIcons.filter(
      (a) => a.kind === 'folder' || a.kind === 'textDocument' || isVfsDesktopFileId(a.id),
    )
    return sortIdsByCoordinate(user)
  }, [desktopIcons])

  const selectableUserIdSet = useMemo(() => new Set(orderedUserIds), [orderedUserIds])

  const handleOpen = useCallback(
    async (id: DesktopAppId) => {
      if (isVfsDesktopFileId(id)) {
        const kind = await openVfsFile(id)
        if (kind === 'unsupported') toast.warning(td('cannotOpenVfsFile'))
        return
      }
      openWindow(id)
    },
    [openWindow, td],
  )

  const onFsDrop = useCallback(
    (result: {
      ids: DesktopAppId[]
      target: { type: string; folderId?: DesktopAppId }
      copy: boolean
    }) => {
      const { ids, target, copy } = result
      const vfsIds = ids.filter((id) => isVfsDesktopFileId(id))
      const itemIds = ids.filter((id) => !isVfsDesktopFileId(id))

      if (target.type === 'recycleBin') {
        if (vfsIds.length > 0) {
          void (async () => {
            for (const path of vfsIds) {
              try {
                await vfs.trash(path)
              } catch {
                // ignore
              }
            }
            await refreshDesktopVfs()
          })()
        }
        if (itemIds.length > 0) {
          const moved = moveItemsToRecycleBin(itemIds)
          if (moved.length === 0 && vfsIds.length === 0) {
            toast.warning(td('cannotDeleteBuiltin'))
            return true
          }
        }
        useDesktopSelectionStore.getState().clear()
        return true
      }
      if (target.type === 'folder' && target.folderId) {
        if (vfsIds.length > 0) toast.warning(td('cannotMoveVfsIntoFolder'))
        if (itemIds.length === 0) return true
        if (copy) {
          void copyItems(itemIds, target.folderId).then((created) => {
            if (created.length === 0) toast.warning(td('cannotMoveIntoFolder'))
            else useDesktopSelectionStore.getState().clear()
          })
          return true
        }
        const moved = moveItemsIntoFolder(itemIds, target.folderId)
        if (moved.length === 0) {
          toast.warning(td('cannotMoveIntoFolder'))
          return true
        }
        useDesktopSelectionStore.getState().clear()
        return true
      }
      if (target.type === 'desktop') {
        const needsBringToDesktop = itemIds.some((id) => {
          const item = itemsRef.current.find((i) => i.id === id)
          return Boolean(item && !item.isDeleted && !isDesktopRootItem(item))
        })
        if (!needsBringToDesktop) return false
        if (copy) {
          void copyItems(itemIds, null).then((created) => {
            if (created.length === 0) toast.warning(td('pasteFail'))
          })
          return true
        }
        const prefer = allocateDesktopCoordinate(Object.values(useDesktopStore.getState().coordinates), [
          4, 1,
        ])
        const moved = moveItemsToDesktop(itemIds, prefer)
        if (moved.length === 0) toast.warning(td('moveFail'))
        else useDesktopSelectionStore.getState().clear()
        return true
      }
      return false
    },
    [
      copyItems,
      moveItemsIntoFolder,
      moveItemsToDesktop,
      moveItemsToRecycleBin,
      refreshDesktopVfs,
      td,
    ],
  )

  const resolveDragIds = useCallback((id: DesktopAppId) => {
    return useDesktopSelectionStore.getState().prepareDragSelection(id, { type: 'desktop' })
  }, [])

  const onItemClick = useCallback(
    (id: DesktopAppId, mods: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
      const sel = useDesktopSelectionStore.getState()
      const isUser = desktopIcons.some(
        (a) =>
          a.id === id &&
          (a.kind === 'folder' || a.kind === 'textDocument' || isVfsDesktopFileId(a.id)),
      )
      if (!isUser) {
        sel.clear()
        return
      }
      sel.ensureScope({ type: 'desktop' })
      if (mods.shiftKey) {
        sel.selectRange(orderedUserIds, id, { type: 'desktop' })
        return
      }
      if (mods.metaKey || mods.ctrlKey) {
        sel.toggle(id, { type: 'desktop' })
        return
      }
      sel.selectOnly(id, { type: 'desktop' })
    },
    [desktopIcons, orderedUserIds],
  )

  const { draggingId, draggingIds, dragPixel, previewCoords, dropTargetId, handleIconPointerDown } =
    useDesktopIconDrag({
      apps: desktopIcons,
      desktopRef,
      onOpen: (id) => {
        void handleOpen(id)
      },
      onCommit: updateCoordinates,
      resolveDragIds,
      onFsDrop,
      isIconDropTarget: (id) => {
        if (id === 'recycleBin') return true
        const item = itemsRef.current.find((i) => i.id === id)
        return item?.kind === 'folder' && !item.isDeleted
      },
      onItemClick,
      onDragStart: (ids) => {
        useDesktopSelectionStore.getState().setSelection(ids, { type: 'desktop' })
      },
    })

  const { marqueeRect, handleBlankPointerDown } = useMarqueeSelect({
    selectableIds: orderedUserIds,
    scopeRoot: desktopRef,
    onSelect: (ids) => {
      useDesktopSelectionStore.getState().setSelection(ids, { type: 'desktop' })
    },
    onClear: () => {
      useDesktopSelectionStore.getState().clear()
    },
  })

  const iconVis = ICON_VIS[iconSize] ?? ICON_VIS.md
  const iconBoxPx = scalePx(iconVis.px, uiScale)

  const draggingApp = draggingId ? desktopIcons.find((a) => a.id === draggingId) : null
  const DragIcon = draggingApp?.icon

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const scope = useDesktopSelectionStore.getState().scope
      if (scope.type !== 'desktop') return
      const meta = e.metaKey || e.ctrlKey
      if (!meta) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const ids = useDesktopSelectionStore.getState().selectedIds
          if (ids.length === 0) return
          e.preventDefault()
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
              await refreshDesktopVfs()
            })()
          }
          if (itemIds.length > 0) moveItemsToRecycleBin(itemIds)
          useDesktopSelectionStore.getState().clear()
        }
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        useDesktopSelectionStore.getState().setSelection(orderedUserIds, { type: 'desktop' })
        return
      }
      if (key === 'c') {
        e.preventDefault()
        useDesktopSelectionStore.getState().copySelection()
        return
      }
      if (key === 'x') {
        e.preventDefault()
        useDesktopSelectionStore.getState().cutSelection()
        return
      }
      if (key === 'v') {
        e.preventDefault()
        void useDesktopSelectionStore.getState().pasteInto(null).then((ids) => {
          if (ids.length === 0) toast.warning(td('pasteFail'))
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [orderedUserIds, moveItemsToRecycleBin, refreshDesktopVfs, td])

  return (
    <div
      ref={desktopRef}
      data-fs-drop='desktop'
      className='relative z-[1] h-full min-h-0 grid items-start content-start'
      style={{
        gridAutoRows: CELL_SIZE,
        gridTemplateColumns: `repeat(auto-fill, ${CELL_SIZE}px)`,
        gap: CELL_GAP,
      }}
      onPointerDown={(e) => {
        handleBlankPointerDown(e, selectedIds.filter((id) => selectableUserIdSet.has(id)))
      }}
    >
      {hasHydrated &&
        desktopIcons.map((app) => {
          const coord = resolveCoordinate(app, previewCoords)
          const [col, row] = coord
          const { left, top } = coordinateToPosition(coord)
          const inDragSet = draggingId != null && draggingIds.includes(app.id)
          const Icon = app.icon
          const yielding = draggingId != null && !inDragSet
          const isDropTarget = dropTargetId === app.id
          const isSelected = selectedIds.includes(app.id)
          const fsKind =
            app.kind === 'folder' || app.kind === 'textDocument' ? app.kind : undefined

          return (
            <DesktopIcon
              key={app.id}
              appId={app.id}
              label={
                isVfsDesktopFileId(app.id)
                  ? (app.title ?? app.id)
                  : resolveDesktopItemTitle(app, tApps, locale)
              }
              showLabel={showIconLabels}
              iconBoxPx={iconBoxPx}
              labelClass={iconVis.label}
              icon={<Icon size={iconVis.px} strokeWidth={iconVis.stroke} absoluteStrokeWidth />}
              col={col}
              row={row}
              left={left}
              top={top}
              isDragging={inDragSet}
              yielding={yielding}
              animateYield={yielding && previewCoords != null}
              isDropTarget={isDropTarget}
              isSelected={isSelected}
              fsKind={fsKind}
              onPointerDown={(e) => handleIconPointerDown(app.id, e)}
            />
          )
        })}

      {draggingApp && DragIcon && dragPixel && (
        <DesktopDragGhost
          left={dragPixel.left}
          top={dragPixel.top}
          icon={<DragIcon size={iconVis.px} strokeWidth={iconVis.stroke} absoluteStrokeWidth />}
          iconBoxPx={iconBoxPx}
          label={
            isVfsDesktopFileId(draggingApp.id)
              ? (draggingApp.title ?? draggingApp.id)
              : resolveDesktopItemTitle(draggingApp, tApps, locale)
          }
          showLabel={showIconLabels}
          labelClass={iconVis.label}
          count={draggingIds.length}
        />
      )}

      <MarqueeOverlay rect={marqueeRect} />
    </div>
  )
}

export function useVisibleDesktopIcons(): DesktopAppView[] {
  return useRootDesktopIcons()
}
