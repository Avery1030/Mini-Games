'use client'

import { useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { DesktopIcon, ICON_VIS } from './DesktopIcon'
import { useDesktopApps, useDesktopHydrated, useDesktopIconDrag } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { CELL_GAP, CELL_SIZE, coordinateToPosition, resolveCoordinate } from '@/lib/desktop'
import { scalePx } from '@/lib/uiScale'
import type { DesktopAppView } from '@/config/desktop'

/**
 * 桌面图标网格 + 拖拽。自行订阅 store，不依赖 Taskbar / Windows 层。
 */
export function DesktopIconsLayer() {
  const t = useTranslations()
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)
  const { showIconLabels, iconSize, uiScale, hidePlaceholderIcons } = useSettingsStore(
    useShallow((s) => ({
      showIconLabels: s.showIconLabels,
      iconSize: s.iconSize,
      uiScale: s.uiScale,
      hidePlaceholderIcons: s.hidePlaceholderIcons,
    })),
  )

  const desktopRef = useRef<HTMLDivElement>(null)

  const desktopIcons = useMemo(() => {
    if (!hasHydrated) return []
    if (!hidePlaceholderIcons) return apps
    return apps.filter((app) => app.app != null)
  }, [apps, hasHydrated, hidePlaceholderIcons])

  const { draggingId, dragPixel, previewCoords, handleIconPointerDown } = useDesktopIconDrag({
    apps: desktopIcons,
    desktopRef,
    onOpen: openWindow,
    onCommit: updateCoordinates,
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

          return (
            <DesktopIcon
              key={app.id}
              appId={app.id}
              label={t(`apps.${app.id}`)}
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
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)

  return useMemo(() => {
    if (!hasHydrated) return []
    if (!hidePlaceholderIcons) return apps
    return apps.filter((app) => app.app != null)
  }, [apps, hasHydrated, hidePlaceholderIcons])
}
