'use client'

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { DesktopAppId } from '@/config/desktop'
import { CELL_SIZE } from '@/lib/desktop'

export const YIELD_TRANSITION = 'left 220ms ease, top 220ms ease'

export const ICON_VIS = {
  sm: { box: 'w-8 h-8', px: 28, label: 'text-[10px]', stroke: 1.5 },
  md: { box: 'w-9 h-9', px: 32, label: 'text-[11px]', stroke: 1.6 },
  lg: { box: 'w-10 h-10', px: 36, label: 'text-xs', stroke: 1.75 },
} as const

export type IconSizeKey = keyof typeof ICON_VIS

/** Win95 桌面图标标签描边（未选中时） */
const ICON_LABEL_OUTLINE =
  '1px 0 0 var(--icon-label-outline), -1px 0 0 var(--icon-label-outline), 0 1px 0 var(--icon-label-outline), 0 -1px 0 var(--icon-label-outline), 1px 1px 0 var(--icon-label-outline)'

export type DesktopIconProps = {
  appId: DesktopAppId
  label: string
  showLabel: boolean
  iconBoxPx: number
  labelClass: string
  icon: ReactNode
  col: number
  row: number
  left: number
  top: number
  isDragging: boolean
  yielding: boolean
  animateYield: boolean
  /** 拖拽投放高亮（如回收站） */
  isDropTarget?: boolean
  /** 多选高亮 */
  isSelected?: boolean
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  /** 用户资源标记，供投放探测 */
  fsKind?: 'folder' | 'textDocument'
}

export function DesktopIcon({
  appId,
  label,
  showLabel,
  iconBoxPx,
  labelClass,
  icon,
  col,
  row,
  left,
  top,
  isDragging,
  yielding,
  animateYield,
  isDropTarget = false,
  isSelected = false,
  onPointerDown,
  fsKind,
}: DesktopIconProps) {
  // 拖拽中保留格点占位（半透明），真正的跟手幽灵由上层 portal 渲染，避免被窗口层挡住
  const layoutStyle: CSSProperties = isDragging
    ? {
        gridColumn: col,
        gridRow: row,
        transition: 'none',
        opacity: 0.35,
      }
    : yielding
      ? {
          position: 'absolute',
          left,
          top,
          transition: animateYield ? YIELD_TRANSITION : 'none',
        }
      : {
          gridColumn: col,
          gridRow: row,
          transition: 'none',
        }

  return (
    <div
      role='button'
      tabIndex={0}
      aria-label={label}
      data-desktop-icon={appId}
      data-fs-kind={fsKind}
      className={cn(
        'group flex flex-col items-center gap-1 px-0.5 py-1 self-start outline-none',
        isDragging ? 'z-[101] cursor-grabbing pointer-events-none' : 'z-[101] cursor-pointer',
        !isDragging && !yielding && 'relative',
        isDropTarget && 'ring-2 ring-[var(--icon-focus-ring)] ring-offset-1 bg-icon-select/25',
        isSelected && !isDragging && 'bg-icon-select/35',
      )}
      style={{
        width: CELL_SIZE,
        boxSizing: 'border-box',
        touchAction: 'none',
        userSelect: 'none',
        ...layoutStyle,
      }}
      onPointerDown={onPointerDown}
    >
      <div
        className={cn(
          'relative flex items-center justify-center text-icon-glyph pointer-events-none',
          '[image-rendering:pixelated]',
          'group-focus-visible:outline-1 group-focus-visible:outline-dashed group-focus-visible:outline-[var(--icon-focus-ring)] group-focus-visible:outline-offset-1',
          '[&_svg]:fill-current [&_svg]:fill-opacity-25',
        )}
        style={{
          width: iconBoxPx,
          height: iconBoxPx,
          filter: 'drop-shadow(1px 1px 0 var(--icon-glyph-shadow))',
        }}
      >
        {icon}
      </div>
      {showLabel && (
        <span
          title={label}
          className={cn(
            labelClass,
            'w-full min-w-0 px-0.5 text-center leading-tight font-pixel pointer-events-none',
            'text-on-desktop whitespace-nowrap overflow-hidden text-ellipsis',
            'group-hover:text-icon-select-fg group-hover:[text-shadow:none]',
            'group-focus-visible:text-icon-select-fg group-focus-visible:[text-shadow:none]',
            'group-active:text-icon-select-fg group-active:[text-shadow:none]',
            isSelected && 'text-icon-select-fg [text-shadow:none]',
          )}
          style={{ textShadow: isSelected ? 'none' : ICON_LABEL_OUTLINE }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
