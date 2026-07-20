'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WindowBounds } from '@/config/desktop'
import {
  MIN_HEIGHT,
  MIN_WIDTH,
  createWindowSeed,
  maximizedSize,
  type ResizeEdge,
  type WindowSeed,
} from '@/lib/desktop/windowGeometry'
import { snapWindowPosition, createSnapSession, type SnapSession } from '@/lib/desktop/windowSnap'

type Point = { x: number; y: number }
type Size = { width: number; height: number }

type UseWindowGeometryOptions = {
  windowId?: string
  rememberedBounds?: WindowBounds | null
  defaultPosition?: Point
  defaultMaximized?: boolean
  width: number
  height: number
  draggable: boolean
  onBoundsChange?: (bounds: WindowBounds) => void
  onClose?: () => void
  onMinimize?: () => void
}

/**
 * 窗口几何：位置/尺寸/最大化记忆，以及拖拽与缩放。
 */
export function useWindowGeometry({
  windowId,
  rememberedBounds = null,
  defaultPosition,
  defaultMaximized = false,
  width,
  height,
  draggable,
  onBoundsChange,
  onClose,
  onMinimize,
}: UseWindowGeometryOptions) {
  const seedRef = useRef<WindowSeed | null>(null)
  if (!seedRef.current) {
    seedRef.current = createWindowSeed({
      rememberedBounds,
      defaultPosition,
      defaultMaximized,
      width,
      height,
    })
  }
  const seed = seedRef.current

  const [position, setPosition] = useState<Point>(() =>
    seed.maximized ? { x: 0, y: 0 } : seed.position,
  )
  const [size, setSize] = useState<Size>(() => (seed.maximized ? maximizedSize() : seed.size))
  const [maximized, setMaximized] = useState(seed.maximized)
  const beforeMaximizeRef = useRef({ position: seed.position, size: seed.size })

  const [isDragging, setIsDragging] = useState(false)
  const [resizing, setResizing] = useState<ResizeEdge | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const snapSession = useRef<SnapSession>(createSnapSession())
  const resizeStart = useRef({ x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 })

  const onBoundsChangeRef = useRef(onBoundsChange)
  onBoundsChangeRef.current = onBoundsChange
  const positionRef = useRef(position)
  const sizeRef = useRef(size)
  const maximizedRef = useRef(maximized)
  positionRef.current = position
  sizeRef.current = size
  maximizedRef.current = maximized

  const emitBounds = useCallback((next?: { position: Point; size: Size; maximized: boolean }) => {
    const p = next?.position ?? positionRef.current
    const s = next?.size ?? sizeRef.current
    const m = next?.maximized ?? maximizedRef.current
    const normal = m ? beforeMaximizeRef.current : { position: p, size: s }
    onBoundsChangeRef.current?.({
      x: normal.position.x,
      y: normal.position.y,
      width: normal.size.width,
      height: normal.size.height,
      maximized: m,
    })
  }, [])

  useEffect(() => {
    if (!seed.maximized) return
    beforeMaximizeRef.current = { position: seed.position, size: seed.size }
    setPosition({ x: 0, y: 0 })
    setSize(maximizedSize())
    setMaximized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    emitBounds({
      position: seed.position,
      size: seed.size,
      maximized: seed.maximized,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 最大化时随浏览器视口同步宽高
  useEffect(() => {
    if (!maximized) return
    const sync = () => {
      setPosition({ x: 0, y: 0 })
      setSize(maximizedSize())
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [maximized])

  const handleTitleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable || e.button !== 0 || maximized) return
      e.preventDefault()
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }
      snapSession.current = createSnapSession()
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
    const onMove = (e: MouseEvent) => {
      // 最大化不可拖；小窗才做边缘软吸附（可强行越过阈值）
      const raw = {
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      }
      if (maximizedRef.current) {
        setPosition(raw)
        return
      }
      setPosition(
        snapWindowPosition(raw, sizeRef.current, snapSession.current, { excludeId: windowId }),
      )
    }
    const onUp = () => {
      setIsDragging(false)
      requestAnimationFrame(() => emitBounds())
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, emitBounds, windowId])

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => {
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
    const onUp = () => {
      setResizing(null)
      requestAnimationFrame(() => emitBounds())
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, emitBounds])

  const handleClose = useCallback(() => {
    emitBounds()
    onClose?.()
  }, [emitBounds, onClose])

  const handleMinimizeClick = useCallback(() => {
    emitBounds()
    onMinimize?.()
  }, [emitBounds, onMinimize])

  return {
    seed,
    position,
    setPosition,
    size,
    setSize,
    maximized,
    setMaximized,
    beforeMaximizeRef,
    positionRef,
    sizeRef,
    isDragging,
    resizing,
    interactivelyMoving: isDragging || resizing != null,
    emitBounds,
    handleTitleMouseDown,
    handleResizeMouseDown,
    handleClose,
    handleMinimizeClick,
  }
}
