'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'
import { winChrome } from '@/utils/winChrome'

const MIN_WIDTH = 200
const MIN_HEIGHT = 150

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface WindowsWindowProps {
  id?: string
  title: string
  onClose?: () => void
  onMinimize?: () => void
  minimized?: boolean
  children?: React.ReactNode
  defaultPosition?: { x: number; y: number }
  width?: number
  height?: number
  draggable?: boolean
  isActive?: boolean
  /** 多窗口叠放层级 */
  zIndex?: number
  onFocus?: () => void
}

/**
 * 老版 Windows 风格弹窗 - 深蓝标题栏、可拖拽、可最小化到任务栏、四边/四角可调整大小
 */
export function WindowsWindow({
  id,
  title,
  onClose,
  onMinimize,
  minimized = false,
  children,
  defaultPosition,
  width: initialWidth = 400,
  height: initialHeight = 320,
  draggable = true,
  isActive = false,
  zIndex = 1000,
  onFocus,
}: WindowsWindowProps) {
  const [position, setPosition] = useState(() => {
    if (defaultPosition) return defaultPosition
    if (typeof window === 'undefined') return { x: 100, y: 80 }
    return {
      x: Math.max(20, (window.innerWidth - initialWidth) / 2),
      y: Math.max(20, (window.innerHeight - initialHeight) / 2 - 40),
    }
  })

  const [size, setSize] = useState({ width: initialWidth, height: initialHeight })
  const [maximized, setMaximized] = useState(false)
  const beforeMaximizeRef = useRef({ position: { x: 0, y: 0 }, size: { width: initialWidth, height: initialHeight } })

  const [isDragging, setIsDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeEdge | null>(null)
  /** 非活跃窗口首次按下后，在 mouseup 前继续挡住事件，避免聚焦后同一次点击穿透 */
  const [consumePointer, setConsumePointer] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 })

  const showFocusShield = !isActive || consumePointer

  useEffect(() => {
    if (!consumePointer) return
    const release = () => setConsumePointer(false)
    window.addEventListener('mouseup', release, true)
    window.addEventListener('pointerup', release, true)
    return () => {
      window.removeEventListener('mouseup', release, true)
      window.removeEventListener('pointerup', release, true)
    }
  }, [consumePointer])

  const handleMaximize = useCallback(() => {
    if (maximized) {
      setPosition(beforeMaximizeRef.current.position)
      setSize(beforeMaximizeRef.current.size)
      setMaximized(false)
    } else {
      beforeMaximizeRef.current = { position: { ...position }, size: { ...size } }
      setPosition({ x: 0, y: 0 })
      setSize({
        width: typeof window !== 'undefined' ? window.innerWidth : 800,
        height: typeof window !== 'undefined' ? window.innerHeight : 600,
      })
      setMaximized(true)
    }
  }, [maximized, position, size])

  const handleTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable || e.button !== 0 || maximized) return
      e.preventDefault()
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }
      setIsDragging(true)
    },
    [draggable, maximized, position],
  )

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, edge: ResizeEdge) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }
      setResizing(edge)
    },
    [position, size],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (!resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const { x, y, left, top, width, height } = resizeStart.current
      const dx = e.clientX - x
      const dy = e.clientY - y

      let newLeft = left
      let newTop = top
      let newWidth = width
      let newHeight = height

      if (resizing.includes('e')) newWidth = Math.max(MIN_WIDTH, width + dx)
      if (resizing.includes('w')) {
        const w = Math.max(MIN_WIDTH, width - dx)
        newLeft = left + (width - w)
        newWidth = w
      }
      if (resizing.includes('s')) newHeight = Math.max(MIN_HEIGHT, height + dy)
      if (resizing.includes('n')) {
        const h = Math.max(MIN_HEIGHT, height - dy)
        newTop = top + (height - h)
        newHeight = h
      }

      setPosition({ x: newLeft, y: newTop })
      setSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => setResizing(null)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing])

  const resizeHandles: { edge: ResizeEdge; className: string; cursor: string }[] = [
    { edge: 'n', className: 'left-0 right-0 top-0 h-[5px]', cursor: 'ns-resize' },
    { edge: 's', className: 'left-0 right-0 bottom-0 h-[5px]', cursor: 's-resize' },
    { edge: 'e', className: 'right-0 top-0 bottom-0 w-[5px]', cursor: 'ew-resize' },
    { edge: 'w', className: 'left-0 top-0 bottom-0 w-[5px]', cursor: 'w-resize' },
    { edge: 'ne', className: 'right-0 top-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
    { edge: 'nw', className: 'left-0 top-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
    { edge: 'se', className: 'right-0 bottom-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
    { edge: 'sw', className: 'left-0 bottom-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
  ]

  return (
    <div
      data-window-id={id}
      className={cn(
        'fixed flex flex-col bg-window text-on-chrome font-pixel transition-colors duration-200',
        maximized
          ? 'border-0 rounded-none'
          : 'border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
      )}
      style={{
        // 用 transform 位移，拖拽时通常比 left/top 更平滑（走合成层）
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: size.width,
        minHeight: size.height,
        willChange: isDragging || resizing ? 'transform' : undefined,
        zIndex,
        visibility: minimized ? 'hidden' : 'visible',
        pointerEvents: minimized ? 'none' : 'auto',
      }}
    >
      {/* 非最大化时显示四边 + 四角调整大小手柄 */}
      {!maximized &&
        resizeHandles.map(({ edge, className, cursor }) => (
          <div
            key={edge}
            className={cn('absolute z-10', className)}
            style={{ cursor }}
            onMouseDown={(e) => handleResizeMouseDown(e, edge)}
            aria-hidden
          />
        ))}

      <div className='flex flex-col flex-1 min-h-0 relative'>
        {/* 标题栏：深蓝底 + 白字 + 最小化 + 最大化/还原 + 关闭 */}
        <div
          className={cn(
            'flex items-center justify-between shrink-0 h-8 px-1 pr-0 select-none font-pixel',
            maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
          )}
          onMouseDown={handleTitleMouseDown}
          style={{ background: isActive ? 'var(--window-title-active)' : 'var(--window-title-inactive)' }}
        >
          <span className='text-[var(--window-title-text)] text-sm font-bold pl-2 truncate'>{title}</span>
          <div className='flex items-stretch shrink-0'>
            {onMinimize != null && (
              <button
                type='button'
                className={cn(
                  winChrome,
                  'shrink-0 w-6 h-6 flex items-center justify-center text-sm font-bold hover:bg-window-btn-hover hover:text-white',
                )}
                aria-label='最小化'
                onClick={(e) => {
                  e.stopPropagation()
                  onMinimize()
                }}
              >
                —
              </button>
            )}
            <button
              type='button'
              className={cn(
                winChrome,
                'shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-window-btn-hover hover:text-white',
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleMaximize()
              }}
              aria-label={maximized ? '还原' : '最大化'}
            >
              {maximized ? '⧉' : '□'}
            </button>
            <button
              type='button'
              className={cn(
                winChrome,
                'shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-window-btn-hover hover:text-white',
              )}
              onClick={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
              aria-label='关闭'
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容区：最大化时去掉边框 */}
        <div
          className={cn(
            'flex-1 min-h-0 overflow-auto p-3 bg-window-body font-pixel',
            maximized
              ? 'border-0'
              : 'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          )}
        >
          {children}
        </div>
      </div>

      {/* 非活跃窗口：首次点击只聚焦，不穿透到内容/标题栏按钮 */}
      {showFocusShield && (
        <div
          className='absolute inset-0 z-[200]'
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConsumePointer(true)
            onFocus?.()
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setConsumePointer(true)
            onFocus?.()
          }}
        />
      )}
    </div>
  )
}
