'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { DesktopAppId } from '@/config/desktop'
import { DRAG_THRESHOLD } from '@/lib/desktop'

const YIELD_MS = 180

export type TaskbarReorderItem = {
  id: DesktopAppId
}

type DragSession = {
  id: DesktopAppId
  pointerId: number
  startX: number
  startY: number
  /** 指针相对按钮左缘 */
  grabOffsetX: number
  buttonWidth: number
  buttonHeight: number
  moved: boolean
  /** 拖拽中预览顺序（含被拖项） */
  order: DesktopAppId[]
  ghostLeft: number
  ghostTop: number
}

export type UseTaskbarReorderOptions = {
  items: TaskbarReorderItem[]
  listRef: RefObject<HTMLElement | null>
  onReorder: (orderedIds: DesktopAppId[]) => void
  onClick: (id: DesktopAppId) => void
}

function moveId(order: DesktopAppId[], id: DesktopAppId, toIndex: number): DesktopAppId[] {
  const without = order.filter((x) => x !== id)
  const clamped = Math.max(0, Math.min(toIndex, without.length))
  without.splice(clamped, 0, id)
  return without
}

function sameOrder(a: DesktopAppId[], b: DesktopAppId[]): boolean {
  if (a.length !== b.length) return false
  return a.every((id, i) => id === b[i])
}

/**
 * 任务栏窗口按钮拖拽排序：只改 openOrder；拖拽中 FLIP 让位过渡。
 */
export function useTaskbarReorder({ items, listRef, onReorder, onClick }: UseTaskbarReorderOptions) {
  const itemsRef = useRef(items)
  itemsRef.current = items
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  const sessionRef = useRef<DragSession | null>(null)
  const [session, setSession] = useState<DragSession | null>(null)
  const firstLeftsRef = useRef<Map<DesktopAppId, number>>(new Map())

  const baseOrder = items.map((i) => i.id)
  const displayOrder =
    session?.moved && session.order.length > 0 ? session.order : baseOrder

  const snapshotLefts = useCallback(() => {
    const root = listRef.current
    const map = new Map<DesktopAppId, number>()
    if (!root) return map
    root.querySelectorAll<HTMLElement>('[data-taskbar-app-id]').forEach((el) => {
      const id = el.dataset.taskbarAppId as DesktopAppId | undefined
      if (!id) return
      map.set(id, el.getBoundingClientRect().left)
    })
    return map
  }, [listRef])

  const insertIndexAt = useCallback(
    (clientX: number, draggingId: DesktopAppId, order: DesktopAppId[]): number => {
      const root = listRef.current
      if (!root) return order.indexOf(draggingId)
      const others = order.filter((id) => id !== draggingId)
      for (let i = 0; i < others.length; i++) {
        const el = root.querySelector<HTMLElement>(`[data-taskbar-app-id="${CSS.escape(String(others[i]))}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (clientX < rect.left + rect.width / 2) return i
      }
      return others.length
    },
    [listRef],
  )

  // FLIP：顺序变化后让其余按钮平滑让位
  useLayoutEffect(() => {
    if (!session?.moved) return
    const root = listRef.current
    if (!root) return
    const first = firstLeftsRef.current
    root.querySelectorAll<HTMLElement>('[data-taskbar-app-id]').forEach((el) => {
      const id = el.dataset.taskbarAppId as DesktopAppId | undefined
      if (!id || id === session.id) return
      const prev = first.get(id)
      if (prev == null) return
      const now = el.getBoundingClientRect().left
      const dx = prev - now
      if (Math.abs(dx) < 0.5) return
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
      void el.offsetWidth
      el.style.transition = `transform ${YIELD_MS}ms ease`
      el.style.transform = 'translateX(0)'
    })
  }, [displayOrder, session?.moved, session?.id, listRef])

  useEffect(() => {
    const clearYieldStyles = () => {
      const root = listRef.current
      if (!root) return
      root.querySelectorAll<HTMLElement>('[data-taskbar-app-id]').forEach((el) => {
        el.style.transition = ''
        el.style.transform = ''
      })
    }

    const onMove = (e: PointerEvent) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return

      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return

      if (!s.moved) {
        firstLeftsRef.current = snapshotLefts()
        s.moved = true
      }

      const ghostLeft = e.clientX - s.grabOffsetX
      const ghostTop = e.clientY - s.buttonHeight / 2
      const nextIndex = insertIndexAt(e.clientX, s.id, s.order)
      const nextOrder = moveId(s.order, s.id, nextIndex)
      const orderChanged = !sameOrder(nextOrder, s.order)
      if (orderChanged) {
        firstLeftsRef.current = snapshotLefts()
        s.order = nextOrder
      }

      const next: DragSession = {
        ...s,
        ghostLeft,
        ghostTop,
        order: s.order,
        moved: true,
      }
      sessionRef.current = next
      setSession(next)
    }

    const onUp = (e: PointerEvent) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      sessionRef.current = null
      setSession(null)
      clearYieldStyles()

      if (!s.moved) {
        onClickRef.current(s.id)
        return
      }
      const base = itemsRef.current.map((i) => i.id)
      if (!sameOrder(s.order, base)) {
        onReorderRef.current(s.order)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [insertIndexAt, listRef, snapshotLefts])

  const onPointerDown = useCallback(
    (id: DesktopAppId, e: ReactPointerEvent) => {
      if (e.button !== 0) return
      const target = (e.currentTarget as HTMLElement).closest(
        '[data-taskbar-app-id]',
      ) as HTMLElement | null
      if (!target) return
      e.preventDefault()
      const rect = target.getBoundingClientRect()
      const order = itemsRef.current.map((i) => i.id)
      const next: DragSession = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffsetX: e.clientX - rect.left,
        buttonWidth: rect.width,
        buttonHeight: rect.height,
        moved: false,
        order,
        ghostLeft: rect.left,
        ghostTop: rect.top,
      }
      sessionRef.current = next
      setSession(next)
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [],
  )

  return {
    displayOrder,
    draggingId: session?.moved ? session.id : null,
    ghost: session?.moved
      ? {
          id: session.id,
          left: session.ghostLeft,
          top: session.ghostTop,
          width: session.buttonWidth,
          height: session.buttonHeight,
        }
      : null,
    onPointerDown,
  }
}
