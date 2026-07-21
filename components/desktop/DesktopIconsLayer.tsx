'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { DesktopIcon, ICON_VIS } from './DesktopIcon'
import { useDesktopApps, useDesktopHydrated, useDesktopIconDrag, hitDesktopIconAtPoint } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { useDesktopItemsStore } from '@/store/desktopItems'
import { isDesktopRootItem } from '@/lib/desktop/itemsTree'
import { CELL_GAP, CELL_SIZE, coordinateToPosition, resolveCoordinate } from '@/lib/desktop'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { scalePx } from '@/lib/uiScale'
import { toast } from '@/components/ui'
import type { DesktopAppId, DesktopAppView } from '@/config/desktop'

function useRootDesktopIcons(): DesktopAppView[] {
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)
  const items = useDesktopItemsStore((s) => s.items)

  return useMemo(() => {
    if (!hasHydrated) return []
    const byId = new Map(items.map((i) => [i.id, i]))
    let list = apps.filter((app) => {
      const item = byId.get(app.id)
      if (!item) return true // 内置应用
      return isDesktopRootItem(item)
    })
    if (hidePlaceholderIcons) {
      list = list.filter((app) => app.app != null)
    }
    return list
  }, [apps, hasHydrated, hidePlaceholderIcons, items])
}

/**
 * 桌面图标网格 + 拖拽。自行订阅 store，不依赖 Taskbar / Windows 层。
 */
export function DesktopIconsLayer() {
  const tApps = useTranslations('apps')
  const td = useTranslations('desktop')
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)
  const moveToRecycleBin = useDesktopItemsStore((s) => s.moveToRecycleBin)
  const moveItemIntoFolder = useDesktopItemsStore((s) => s.moveItemIntoFolder)
  const items = useDesktopItemsStore((s) => s.items)
  const { showIconLabels, iconSize, uiScale } = useSettingsStore(
    useShallow((s) => ({
      showIconLabels: s.showIconLabels,
      iconSize: s.iconSize,
      uiScale: s.uiScale,
    })),
  )

  const desktopRef = useRef<HTMLDivElement>(null)
  const desktopIcons = useRootDesktopIcons()

  const desktopIconsRef = useRef(desktopIcons)
  desktopIconsRef.current = desktopIcons
  const itemsRef = useRef(items)
  itemsRef.current = items

  const onDropAtPoint = useCallback(
    (draggedId: DesktopAppId, clientX: number, clientY: number) => {
      if (draggedId === 'recycleBin') return false
      const hit = hitDesktopIconAtPoint(clientX, clientY, draggedId)
      if (!hit) return false

      const dragged = itemsRef.current.find((i) => i.id === draggedId)
      const isUserItem = dragged != null && !dragged.isDeleted

      if (hit === 'recycleBin') {
        if (!isUserItem) {
          toast.warning(td('cannotDeleteBuiltin'))
          return true
        }
        return moveToRecycleBin(draggedId)
      }

      const target = itemsRef.current.find((i) => i.id === hit)
      if (target?.kind === 'folder' && !target.isDeleted) {
        if (!isUserItem) {
          toast.warning(td('cannotMoveBuiltin'))
          return true
        }
        if (!moveItemIntoFolder(draggedId, hit)) {
          toast.warning(td('cannotMoveIntoFolder'))
          return true
        }
        return true
      }

      return false
    },
    [moveToRecycleBin, moveItemIntoFolder, td],
  )

  const isFolderDropTarget = useCallback(
    (id: DesktopAppId) => {
      const item = itemsRef.current.find((i) => i.id === id)
      return item?.kind === 'folder' && !item.isDeleted
    },
    [],
  )

  const { draggingId, dragPixel, previewCoords, dropTargetId, handleIconPointerDown } =
    useDesktopIconDrag({
      apps: desktopIcons,
      desktopRef,
      onOpen: openWindow,
      onCommit: updateCoordinates,
      onDropAtPoint,
      isDropTarget: (id) => id === 'recycleBin' || isFolderDropTarget(id),
    })

  const iconVis = ICON_VIS[iconSize] ?? ICON_VIS.md
  const iconBoxPx = scalePx(iconVis.px, uiScale)

  return (
    <div
      ref={desktopRef}
      className='relative h-full min-h-0 grid items-start content-start'
      style={{
        gridAutoRows: CELL_SIZE,
        gridTemplateColumns: `repeat(auto-fill, ${CELL_SIZE}px)`,
        gap: CELL_GAP,
      }}
    >
      {hasHydrated &&
        desktopIcons.map((app) => {
          const coord = resolveCoordinate(app, previewCoords)
          const [col, row] = coord
          const { left, top } = coordinateToPosition(coord)
          const isDragging = draggingId === app.id
          const Icon = app.icon
          const yielding = draggingId != null && !isDragging
          const isDropTarget = dropTargetId === app.id

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
              isDragging={isDragging}
              yielding={yielding}
              animateYield={yielding && previewCoords != null}
              isDropTarget={isDropTarget}
              dragLeft={isDragging ? dragPixel?.left : undefined}
              dragTop={isDragging ? dragPixel?.top : undefined}
              onPointerDown={(e) => handleIconPointerDown(app.id, e)}
            />
          )
        })}
    </div>
  )
}

/** 供右键菜单：与 IconsLayer 相同过滤规则的可见图标列表 */
export function useVisibleDesktopIcons(): DesktopAppView[] {
  return useRootDesktopIcons()
}
