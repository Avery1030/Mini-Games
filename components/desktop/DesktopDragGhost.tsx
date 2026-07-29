'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { CELL_SIZE } from '@/lib/desktop'
import { cn } from '@/lib/cn'
import { isServer } from '@/lib/env'

type DesktopDragGhostProps = {
  left: number
  top: number
  icon: ReactNode
  iconBoxPx: number
  label?: string
  showLabel?: boolean
  labelClass?: string
  count?: number
  copy?: boolean
}

/** 挂到 body，保证拖过窗口时仍跟手可见 */
export function DesktopDragGhost({
  left,
  top,
  icon,
  iconBoxPx,
  label,
  showLabel,
  labelClass,
  count,
  copy,
}: DesktopDragGhostProps) {
  if (isServer) return null

  return createPortal(
    <div
      className={cn('fixed z-[10000] pointer-events-none flex flex-col items-center gap-1 px-0.5 py-1', 'opacity-90')}
      style={{ left, top, width: CELL_SIZE }}
      aria-hidden
    >
      <div
        className='relative flex items-center justify-center text-icon-glyph [image-rendering:pixelated] [&_svg]:fill-current [&_svg]:fill-opacity-25'
        style={{
          width: iconBoxPx,
          height: iconBoxPx,
          filter: 'drop-shadow(1px 1px 0 var(--icon-glyph-shadow))',
        }}
      >
        {icon}
        {count != null && count > 1 && (
          <span className='absolute -top-1 -right-1 min-w-[1.1rem] h-4 px-1 rounded-sm bg-accent text-white text-[10px] leading-4 text-center font-pixel'>
            {count}
          </span>
        )}
      </div>
      {showLabel && label && (
        <span
          className={cn(
            labelClass,
            'w-full min-w-0 px-0.5 text-center leading-tight font-pixel',
            'text-on-desktop whitespace-nowrap overflow-hidden text-ellipsis',
          )}
        >
          {label}
        </span>
      )}
      {copy && (
        <span className='text-[10px] px-1 bg-chrome text-on-chrome border border-chrome-dark font-pixel'>+</span>
      )}
    </div>,
    document.body,
  )
}
