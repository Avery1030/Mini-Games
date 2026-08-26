'use client'

import { Children, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from './cn'
import { isClient } from '@/lib/env'

export type SplitPaneProps = {
  /** 左侧（主栏）与右侧（次栏） */
  children: ReactNode
  /** 主栏默认宽度（px） */
  defaultSize?: number
  minSize?: number
  maxSize?: number
  /** 若提供，宽度会写入 localStorage 记住 */
  storageKey?: string
  className?: string
  /** 分隔条无障碍名称 */
  handleLabel?: string
}

function readStored(key: string | undefined, fallback: number): number {
  if (!key || !isClient) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string | undefined, value: number) {
  if (!key || !isClient) return
  try {
    localStorage.setItem(key, String(Math.round(value)))
  } catch {
    /* ignore */
  }
}

/**
 * 可拖拽左右分栏：拖动中间分隔条调节主栏宽度（Win95 风格细槽）。
 * 双击分隔条可恢复默认宽度。
 */
export function SplitPane({
  children,
  defaultSize = 148,
  minSize = 96,
  maxSize = 360,
  storageKey,
  className,
  handleLabel = 'Resize',
}: SplitPaneProps) {
  const items = Children.toArray(children)
  const primary = items[0] ?? null
  const secondary = items[1] ?? null

  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const sizeRef = useRef(defaultSize)
  const [size, setSize] = useState(() => Math.min(maxSize, Math.max(minSize, readStored(storageKey, defaultSize))))
  const [dragging, setDragging] = useState(false)
  const handleId = useId()
  sizeRef.current = size

  const clamp = useCallback((next: number) => Math.min(maxSize, Math.max(minSize, next)), [minSize, maxSize])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    draggingRef.current = true
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setSize(clamp(e.clientX - rect.left))
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    writeStored(storageKey, sizeRef.current)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.cursor
    const prevSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prev
      document.body.style.userSelect = prevSelect
    }
  }, [dragging])

  return (
    <div ref={containerRef} className={cn('flex min-h-0 min-w-0 flex-1', className)}>
      <div className='flex min-h-0 shrink-0 flex-col overflow-hidden' style={{ width: size }}>
        {primary}
      </div>

      <div
        role='separator'
        id={handleId}
        tabIndex={0}
        aria-label={handleLabel}
        aria-orientation='vertical'
        aria-valuenow={Math.round(size)}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        className={cn(
          'group relative w-2.5 shrink-0 cursor-col-resize touch-none outline-none',
          'border-0 p-0',
          'flex items-center justify-center',
          'bg-transparent hover:bg-chrome-hover/70',
          'focus-visible:bg-chrome-hover/70',
          dragging && 'bg-chrome-active/80',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          const reset = clamp(defaultSize)
          setSize(reset)
          writeStored(storageKey, reset)
        }}
      >
        {/* 凹槽竖线 */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2',
            'bg-chrome-dark shadow-[1px_0_0_var(--chrome-light)]',
            'opacity-70 group-hover:opacity-100',
            dragging && 'opacity-100',
          )}
        />
        {/* 中部抓手：几道横纹，提示可拖 */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none relative z-[1] flex flex-col gap-[3px] py-1 px-0.5',
            'rounded-[1px]',
            'bg-chrome/90 group-hover:bg-chrome',
            'shadow-[inset_1px_0_0_var(--chrome-light),inset_-1px_0_0_var(--chrome-dark)]',
            dragging && 'bg-chrome-active',
          )}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className='block h-px w-[7px] bg-chrome-dark shadow-[0_1px_0_var(--chrome-light)]' />
          ))}
        </span>
      </div>

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>{secondary}</div>
    </div>
  )
}
