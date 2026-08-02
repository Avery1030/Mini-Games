'use client'

import {
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { type DesktopAppId } from '@/config/desktop'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

type AppIcon = ComponentType<{
  className?: string
  size?: number
}>

type Props = {
  id: DesktopAppId
  title: string
  icon: AppIcon
  pressed: boolean
  /** 正在被拖拽（高亮，非幽灵） */
  dragging?: boolean
  onPointerDown: (e: ReactPointerEvent) => void
  onContextMenu?: (e: ReactMouseEvent) => void
}

/**
 * 任务栏窗口按钮；按住拖拽排序（由父级处理）。
 */
export function TaskbarWindowButton({
  id,
  title,
  icon: Icon,
  pressed,
  dragging = false,
  onPointerDown,
  onContextMenu,
}: Props) {
  return (
    <div
      data-taskbar-app-id={id}
      className={cn(
        'relative shrink-0 touch-none',
        dragging && 'z-10 brightness-110 ring-1 ring-accent cursor-grabbing will-change-transform',
      )}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu?.(e)
      }}
    >
      <Button
        size='md'
        variant={pressed ? 'pressed' : 'raised'}
        className='max-w-[160px] px-2 py-1.5 h-auto gap-1.5 justify-start pointer-events-none'
        title={title}
        tabIndex={-1}
        aria-hidden
      >
        <Icon size={14} className='shrink-0' aria-hidden />
        <span className='truncate'>{title}</span>
      </Button>
    </div>
  )
}
