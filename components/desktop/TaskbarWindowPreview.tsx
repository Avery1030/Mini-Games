'use client'

import { useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { mountWindowPreviewClone, queryWindowEl } from '@/lib/windowPreview'
import { WinCloseIcon } from '@/components/ui/WindowChromeIcons'
import { type DesktopAppId } from '@/config/desktop'
import { useWindowStore } from '@/store/window'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

type AppIcon = ComponentType<{
  className?: string
  size?: number
}>

type Props = {
  windowId: DesktopAppId
  title: string
  icon: AppIcon
  /** 任务栏按钮锚点，用于定位预览 */
  anchorEl: HTMLElement | null
  onActivate: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function previewPos(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)),
    bottom: Math.max(8, window.innerHeight - rect.top + 6),
  }
}

/**
 * 任务栏悬停预览：Win95 边框内显示窗口缩略图。
 */
export function TaskbarWindowPreview({
  windowId,
  title,
  icon: Icon,
  anchorEl,
  onActivate,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => (anchorEl ? previewPos(anchorEl) : null))
  const [hasThumb, setHasThumb] = useState(false)
  const { closeWindow } = useWindowStore()

  useLayoutEffect(() => {
    if (!anchorEl) return
    const update = () => setPos(previewPos(anchorEl))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [anchorEl])

  const posLeft = pos?.left
  const posBottom = pos?.bottom

  // portal 提交后再克隆；host 的 className 保持不变，避免 React 重渲染清掉命令式子节点
  useLayoutEffect(() => {
    if (posLeft == null || posBottom == null) return
    const host = hostRef.current
    if (!host) {
      setHasThumb(false)
      return
    }
    const source = queryWindowEl(windowId)
    if (!source) {
      host.replaceChildren()
      setHasThumb(false)
      return
    }
    const cleanup = mountWindowPreviewClone(source, host)
    setHasThumb(host.childElementCount > 0)
    return () => {
      cleanup()
      setHasThumb(false)
    }
  }, [windowId, posLeft, posBottom])

  if (!pos || typeof document === 'undefined') return null

  return createPortal(
    <div
      role='dialog'
      aria-label={title}
      className={cn(
        'fixed z-[1200] flex flex-col gap-1 p-1 min-w-[120px] max-w-[240px]',
        'bg-chrome text-on-chrome font-pixel',
        'border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
        'shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
      )}
      style={{ left: pos.left, bottom: pos.bottom }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className='flex items-center justify-between h-6 px-1.5 shrink-0 bg-[var(--window-title-active)]'>
        <div className='flex items-center gap-1.5'>
          <Icon size={12} className='shrink-0 text-[var(--window-title-text)]' aria-hidden />
          <span className='truncate text-xs font-bold text-[var(--window-title-text)]'>{title}</span>
        </div>
        <div
          className='cursor-pointer'
          onClick={(e) => {
            e.stopPropagation()
            closeWindow(windowId)
          }}
        >
          <WinCloseIcon size={12} className='shrink-0 text-[var(--window-title-text)]' aria-hidden />
        </div>
      </div>
      <div
        className={cn(
          'flex items-center justify-center bg-window-body overflow-hidden',
          'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
        )}
        onClick={(e) => {
          e.stopPropagation()
          onActivate()
        }}
      >
        {/* className 勿随 hasThumb 变化，否则 reconcile 会清掉 clone 节点 */}
        <div ref={hostRef} className='[&:empty]:hidden' />
        {!hasThumb && (
          <div className='flex flex-col items-center gap-2 py-6 px-4 text-on-chrome/70'>
            <Icon size={28} aria-hidden />
            <span className='text-xs truncate max-w-[180px]'>{title}</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
