'use client'

import { useRef, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'

type Props = {
  axis: 'x' | 'y'
  size: number
  onSize: (next: number) => void
  onReset?: () => void
  label: string
}

/**
 * 表头边缘拖拽条：不改变表头外观，仅在边缘提供改宽/改高命中区。
 */
export function SheetResizeHandle({ axis, size, onSize, onReset, label }: Props) {
  const drag = useRef<Nullable<{ origin: number; size: number }>>(null)

  const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { origin: axis === 'x' ? e.clientX : e.clientY, size }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const start = drag.current
    if (!start || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const now = axis === 'x' ? e.clientX : e.clientY
    onSize(start.size + (now - start.origin))
  }

  const endDrag = (e: PointerEvent<HTMLSpanElement>) => {
    if (!drag.current) return
    drag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  return (
    <span
      role='separator'
      aria-label={label}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={cn(
        'absolute z-[4] touch-none',
        axis === 'x'
          ? 'right-0 top-0 h-full w-1.5 cursor-col-resize'
          : 'bottom-0 left-0 h-1.5 w-full cursor-row-resize',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onReset?.()
      }}
    />
  )
}
