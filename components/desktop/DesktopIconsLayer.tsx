'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
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
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { scalePx } from '@/lib/uiScale'
import { toast } from '@/components/ui'
import type { DesktopAppId, DesktopAppView } from '@/config/desktop'
import { allocateDesktopCoordinate } from '@/lib/desktop/window'

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

/**
 * 桌面图标网格 + 多选拖拽 + 框选。自行订阅 store。
 */
export function DesktopIconsLayer() {
  const tApps = useTranslations('apps')
  const td = useTranslations('desktop')
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)
  const moveItemsToRecycleBin = useDesktopItemsStore((s) => s.moveItemsToRecycleBin)
  const moveItemsIntoFolder = useDesktopItemsStore((s) => s.moveItemsIntoFolder)
  const copyItems = useDesktopItemsStore((s) => s.copyItems)
  const moveItemsToDesktop = useDesktopItemsStore((s) => s.moveItemsToDesktop)
  const items = useDesktopItemsStore((s) => s.items)
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
  const desktopIcons = useRootDesktopIcons()
  const itemsRef = useRef(items)
  itemsRef.current = items

  const orderedUserIds = useMemo(() => {
    const user = desktopIcons.filter((a) => a.kind === 'folder' || a.kind === 'textDocument')
    return sortIdsByCoordinate(user)
  }, [desktopIcons])

  const selectableUserIdSet = useMemo(() => new Set(orderedUserIds), [orderedUserIds])

  const onFsDrop = useCallback(
    (result: {
      ids: DesktopAppId[]
      target: { type: string; folderId?: DesktopAppId }
      copy: boolean
    }) => {
      const { ids, target, copy } = result
      if (target.type === 'recycleBin') {
        const moved = moveItemsToRecycleBin(ids)
        if (moved.length === 0) {
          toast.warning(td('cannotDeleteBuiltin'))
          return true
        }
        useDesktopSelectionStore.getState().clear()
        return true
      }
      if (target.type === 'folder' && target.folderId) {
        if (copy) {
          void copyItems(ids, target.folderId).then((created) => {
            if (created.length === 0) toast.warning(td('cannotMoveIntoFolder'))
            else useDesktopSelectionStore.getState().clear()
          })
          return true
        }
        const moved = moveItemsIntoFolder(ids, target.folderId)
        if (moved.length === 0) {
          toast.warning(td('cannotMoveIntoFolder'))
          return true
        }
        useDesktopSelectionStore.getState().clear()
        return true
      }
      if (target.type === 'desktop') {
        // 已在桌面根上的图标（含内置应用、桌面文件夹）：交给格点重排，不要走 FS move
        const needsBringToDesktop = ids.some((id) => {
          const item = itemsRef.current.find((i) => i.id === id)
          return Boolean(item && !item.isDeleted && !isDesktopRootItem(item))
        })
        if (!needsBringToDesktop) return false
        if (copy) {
          void copyItems(ids, null).then((created) => {
            if (created.length === 0) toast.warning(td('pasteFail'))
          })
          return true
        }
        const prefer = allocateDesktopCoordinate(Object.values(useDesktopStore.getState().coordinates), [
          4, 1,
        ])
        const moved = moveItemsToDesktop(ids, prefer)
        if (moved.length === 0) toast.warning(td('moveFail'))
        else useDesktopSelectionStore.getState().clear()
        return true
      }
      return false
    },
    [moveItemsToRecycleBin, moveItemsIntoFolder, copyItems, moveItemsToDesktop, td],
  )

  const resolveDragIds = useCallback((id: DesktopAppId) => {
    return useDesktopSelectionStore.getState().prepareDragSelection(id, { type: 'desktop' })
  }, [])

  const onItemClick = useCallback(
    (id: DesktopAppId, mods: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => {
      const sel = useDesktopSelectionStore.getState()
      const isUser = desktopIcons.some(
        (a) => a.id === id && (a.kind === 'folder' || a.kind === 'textDocument'),
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
      onOpen: openWindow,
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
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const scope = useDesktopSelectionStore.getState().scope
      if (scope.type !== 'desktop') return
      const meta = e.metaKey || e.ctrlKey
      if (!meta) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const ids = useDesktopSelectionStore.getState().selectedIds
          if (ids.length === 0) return
          e.preventDefault()
          moveItemsToRecycleBin(ids)
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
  }, [orderedUserIds, moveItemsToRecycleBin, td])

  return (
    <div
      ref={desktopRef}
      data-fs-drop='desktop'
      className='relative h-full min-h-0 grid items-start content-start'
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
              label={resolveDesktopItemTitle(app, tApps)}
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
          label={resolveDesktopItemTitle(draggingApp, tApps)}
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
