'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import type { DesktopAppId } from '@/config/desktop'
import { DRAG_THRESHOLD, hitIdsInMarquee, normalizeMarquee, type MarqueeRect } from '@/lib/desktop'

type MarqueeSession = {
  pointerId: number
  startX: number
  startY: number
  additive: boolean
  moved: boolean
  baseIds: DesktopAppId[]
}

type UseMarqueeSelectOptions = {
  /** 可被框选的 id（如仅用户资源） */
  selectableIds: DesktopAppId[]
  scopeRoot?: React.RefObject<HTMLElement | null>
  itemAttr?: string
  onSelect: (ids: DesktopAppId[], opts: { additive: boolean }) => void
  onClear?: () => void
}

/**
 * 空白处拖动框选。未超过阈值的单击走 onClear。
 */
export function useMarqueeSelect({
  selectableIds,
  scopeRoot,
  itemAttr = 'data-desktop-icon',
  onSelect,
  onClear,
}: UseMarqueeSelectOptions) {
  const [rect, setRect] = useState<MarqueeRect | null>(null)
  const sessionRef = useRef<MarqueeSession | null>(null)
  const selectableRef = useRef(selectableIds)
  selectableRef.current = selectableIds
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear

  const applyHits = useCallback(
    (clientX: number, clientY: number, session: MarqueeSession) => {
      const box = normalizeMarquee(session.startX, session.startY, clientX, clientY)
      setRect(box)
      const allowed = new Set(selectableRef.current)
      const hits = hitIdsInMarquee(box, {
        root: scopeRoot?.current ?? document,
        attr: itemAttr,
        allowedIds: allowed,
      })
      if (session.additive) {
        const merged = [...new Set([...session.baseIds, ...hits])]
        onSelectRef.current(merged, { additive: true })
      } else {
        onSelectRef.current(hits, { additive: false })
      }
    },
    [itemAttr, scopeRoot],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY
      if (!session.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        session.moved = true
      }
      applyHits(e.clientX, e.clientY, session)
    }

    const onUp = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      sessionRef.current = null
      if (!session.moved) {
        setRect(null)
        if (!session.additive) onClearRef.current?.()
        return
      }
      applyHits(e.clientX, e.clientY, session)
      setRect(null)
    }

    const onCancel = () => {
      if (!sessionRef.current) return
      sessionRef.current = null
      setRect(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [applyHits])

  const handleBlankPointerDown = useCallback(
    (e: ReactPointerEvent, baseIds: DesktopAppId[] = []) => {
      if (e.button !== 0) return
      const target = e.target as Element | null
      // 点在可选条目上时不启动框选（交给条目拖拽/点击）
      if (target?.closest?.(`[${itemAttr}]`)) return
      e.preventDefault()
      sessionRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        additive: e.metaKey || e.ctrlKey,
        moved: false,
        baseIds,
      }
    },
    [itemAttr],
  )

  return { marqueeRect: rect, handleBlankPointerDown }
}

export function MarqueeOverlay({ rect }: { rect: MarqueeRect | null }) {
  if (!rect || (rect.width < 2 && rect.height < 2)) return null
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      aria-hidden
      className='fixed z-[9990] pointer-events-none border border-[var(--icon-focus-ring)] bg-icon-select/20'
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />,
    document.body,
  )
}
