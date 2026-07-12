'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_WIDTH = 200
const MIN_HEIGHT = 150

export type ResizeEdge =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

export interface WindowsWindowProps {
  /** 窗口唯一 id，用于任务栏标签 */
  id?: string
  /** 标题栏文字 */
  title: string
  /** 关闭回调 */
  onClose?: () => void
  /** 最小化回调，点击最小化按钮时调用 */
  onMinimize?: () => void
  /** 是否处于最小化状态（由父组件控制，最小化时窗口隐藏、任务栏显示标签） */
  minimized?: boolean
  /** 弹窗内容 */
  children?: React.ReactNode
  /** 初始位置（默认大致居中） */
  defaultPosition?: { x: number; y: number }
  /** 初始宽度（默认 400px） */
  width?: number
  /** 初始高度（默认 320px） */
  height?: number
  /** 是否可拖拽（默认 true） */
  draggable?: boolean
  /** 是否为当前置顶窗口（层级最高） */
  isActive?: boolean
  /** 窗口被点击时调用，用于置顶该窗口 */
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
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 })

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
    [draggable, maximized, position]
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
    [position, size]
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
      className={`windows-window fixed flex flex-col bg-[#c0c0c0] ${maximized ? 'border-0 rounded-none' : 'border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'}`}
      style={{
        // 用 transform 位移，拖拽时通常比 left/top 更平滑（走合成层）
        left: 0,
        top: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: size.width,
        minHeight: size.height,
        willChange: isDragging || resizing ? 'transform' : undefined,
        zIndex: isActive ? 1001 : 1000,
        visibility: minimized ? 'hidden' : 'visible',
        pointerEvents: minimized ? 'none' : 'auto',
      }}
      onMouseDown={() => onFocus?.()}
    >
      {/* 非最大化时显示四边 + 四角调整大小手柄 */}
      {!maximized &&
        resizeHandles.map(({ edge, className, cursor }) => (
          <div
            key={edge}
            className={`absolute ${className} z-10`}
            style={{ cursor }}
            onMouseDown={(e) => handleResizeMouseDown(e, edge)}
            aria-hidden
          />
        ))}

      <div className="windows-window-border flex flex-col flex-1 min-h-0 relative">
        {/* 标题栏：深蓝底 + 白字 + 最小化 + 最大化/还原 + 关闭 */}
        <div
          className={`windows-window-title flex items-center justify-between shrink-0 h-8 px-1 pr-0 select-none ${maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
          onMouseDown={handleTitleMouseDown}
          style={{ background: '#000080' }}
        >
          <span className="text-white text-sm font-bold pl-2 truncate pixel-text">
            {title}
          </span>
          <div className="flex items-stretch shrink-0">
            {onMinimize != null && (
              <button
                type="button"
                className="windows-window-btn shrink-0 w-6 h-6 flex items-center justify-center text-black text-sm font-bold border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#0000aa] hover:text-white active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white active:bg-[#000080]"
                style={{ background: '#c0c0c0' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onMinimize()
                }}
                aria-label="最小化"
              >
                —
              </button>
            )}
            <button
              type="button"
              className="windows-window-btn shrink-0 w-6 h-6 flex items-center justify-center text-black text-xs font-bold border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#0000aa] hover:text-white active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white active:bg-[#000080]"
              style={{ background: '#c0c0c0' }}
              onClick={(e) => {
                e.stopPropagation()
                handleMaximize()
              }}
              aria-label={maximized ? '还原' : '最大化'}
            >
              {maximized ? '⧉' : '□'}
            </button>
            <button
              type="button"
              className="windows-window-close shrink-0 w-6 h-6 flex items-center justify-center text-black text-xs font-bold border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#0000aa] hover:text-white active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white active:bg-[#000080]"
              style={{ background: '#c0c0c0' }}
              onClick={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容区：最大化时去掉边框 */}
        <div
          className={`windows-window-body flex-1 min-h-0 overflow-auto bg-black p-3 ${maximized ? 'border-0' : 'border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white'}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
