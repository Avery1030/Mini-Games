'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { TaskbarWindowPreview } from './TaskbarWindowPreview'
import { type DesktopAppId } from '@/config/desktop'
import { Button } from '@/components/ui'

const SHOW_DELAY_MS = 380
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
  onClick: () => void
}

/**
 * 任务栏窗口按钮：悬停延迟后弹出窗口缩略预览。
 */
export function TaskbarWindowButton({ id, title, icon: Icon, pressed, onClick }: Props) {
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

  const activate = () => {
    clearTimers()
    setPreviewOpen(false)
    onClick()
  }

  return (
    <div ref={rootRef} className='relative shrink-0' onMouseEnter={scheduleShow} onMouseLeave={scheduleHide}>
      <Button
        size='md'
        variant={pressed ? 'pressed' : 'raised'}
        className='max-w-[160px] px-2 py-1.5 h-auto gap-1.5 justify-start'
        title={title}
        onClick={activate}
      >
        <Icon size={14} className='shrink-0' aria-hidden />
        <span className='truncate'>{title}</span>
      </Button>
      {previewOpen && (
        <TaskbarWindowPreview
          windowId={id}
          title={title}
          icon={Icon}
          anchorEl={rootRef.current}
          onActivate={activate}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  )
}
