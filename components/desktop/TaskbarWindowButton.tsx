'use client'

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { TaskbarWindowPreview } from './TaskbarWindowPreview'
import { type DesktopAppId } from '@/config/desktop'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

const SHOW_DELAY_MS = 1500
const HIDE_DELAY_MS = 160

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
  /** 预览卡片内点击激活（不走拖拽） */
  onActivate: () => void
  onPointerDown: (e: ReactPointerEvent) => void
  onContextMenu?: (e: ReactMouseEvent) => void
}

/**
 * 任务栏窗口按钮：悬停预览；按住拖拽排序（由父级处理）。
 */
export function TaskbarWindowButton({
  id,
  title,
  icon: Icon,
  pressed,
  dragging = false,
  onActivate,
  onPointerDown,
  onContextMenu,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    showTimer.current = null
    hideTimer.current = null
  }

  const scheduleShow = () => {
    if (dragging) return
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    if (previewOpen) return
    if (showTimer.current) clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => setPreviewOpen(true), SHOW_DELAY_MS)
  }

  const scheduleHide = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setPreviewOpen(false), HIDE_DELAY_MS)
  }

  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    if (!dragging) return
    clearTimers()
    setPreviewOpen(false)
  }, [dragging])

  return (
    <div
      ref={rootRef}
      data-taskbar-app-id={id}
      className={cn(
        'relative shrink-0 touch-none',
        dragging && 'z-10 brightness-110 ring-1 ring-accent cursor-grabbing will-change-transform',
      )}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        clearTimers()
        setPreviewOpen(false)
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
      {previewOpen && !dragging && (
        <TaskbarWindowPreview
          windowId={id}
          title={title}
          icon={Icon}
          anchorEl={rootRef.current}
          onActivate={() => {
            clearTimers()
            setPreviewOpen(false)
            onActivate()
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  )
}
