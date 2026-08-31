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
  /** 指针相对按钮左缘的抓取偏移（用于实时跟随） */
  grabOffsetX: number
  /** 最近一次指针 X（让位重排后重新校准 transform） */
  lastClientX: number
  moved: boolean
  /** 拖拽中预览顺序（含被拖项） */
  order: DesktopAppId[]
}

export type UseTaskbarReorderOptions = {
  items: TaskbarReorderItem[]
  listRef: RefObject<Nullable<HTMLElement>>
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
 * 任务栏窗口按钮拖拽排序：仅 X 轴；被拖项实时跟随指针；其余 FLIP 让位；只改 openOrder。
 */
export function useTaskbarReorder({ items, listRef, onReorder, onClick }: UseTaskbarReorderOptions) {
  const itemsRef = useRef(items)
  itemsRef.current = items
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  const sessionRef = useRef<Nullable<DragSession>>(null)
  const [session, setSession] = useState<Nullable<DragSession>>(null)
  const firstLeftsRef = useRef<Map<DesktopAppId, number>>(new Map())

  const baseOrder = items.map((i) => i.id)
  const displayOrder = session?.moved && session.order.length > 0 ? session.order : baseOrder

  const snapshotLefts = useCallback(() => {
    const root = listRef.current
    const map = new Map<DesktopAppId, number>()
    if (!root) return map
    root.querySelectorAll<HTMLElement>('[data-taskbar-app-id]').forEach((el) => {
      const id = el.dataset.taskbarAppId as DesktopAppId | undefined
      if (!id) return
      const prev = el.style.transform
      el.style.transform = 'none'
      map.set(id, el.getBoundingClientRect().left)
      el.style.transform = prev
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
        const prev = el.style.transform
        el.style.transform = 'none'
        const rect = el.getBoundingClientRect()
        el.style.transform = prev
        if (clientX < rect.left + rect.width / 2) return i
      }
      return others.length
    },
    [listRef],
  )

  /** 被拖按钮：按抓取点跟随指针 X（布局槽位变化后重新校准） */
  const syncDragTransform = useCallback(
    (clientX: number) => {
      const s = sessionRef.current
      if (!s?.moved) return
      const root = listRef.current
      if (!root) return
      const el = root.querySelector<HTMLElement>(`[data-taskbar-app-id="${CSS.escape(String(s.id))}"]`)
      if (!el) return
      el.style.transition = 'none'
      el.style.transform = 'none'
      const layoutLeft = el.getBoundingClientRect().left
      const dx = clientX - s.grabOffsetX - layoutLeft
      el.style.transform = `translateX(${dx}px)`
    },
    [listRef],
  )

  // FLIP：顺序变化后让其余按钮平滑让位；再校准被拖项跟随位置
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
      const t = el.style.transform
      el.style.transform = 'none'
      const now = el.getBoundingClientRect().left
      el.style.transform = t
      const dx = prev - now
      if (Math.abs(dx) < 0.5) return
      el.style.transition = 'none'
      el.style.transform = `translateX(${dx}px)`
      void el.offsetWidth
      el.style.transition = `transform ${YIELD_MS}ms ease`
      el.style.transform = 'translateX(0)'
    })
    syncDragTransform(sessionRef.current?.lastClientX ?? session.lastClientX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayOrder, session?.moved, session?.id, listRef, syncDragTransform])

  useEffect(() => {
    const clearDragStyles = () => {
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

      // 仅认 X 轴位移，纵向滑动不启动/不干扰排序
      const dx = e.clientX - s.startX
      let becameMoved = false
      if (!s.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return
        firstLeftsRef.current = snapshotLefts()
        s.moved = true
        becameMoved = true
      }

      s.lastClientX = e.clientX

      const nextIndex = insertIndexAt(e.clientX, s.id, s.order)
      const nextOrder = moveId(s.order, s.id, nextIndex)
      const orderChanged = !sameOrder(nextOrder, s.order)
      if (orderChanged) {
        firstLeftsRef.current = snapshotLefts()
        s.order = nextOrder
      }

      // 仅在开始拖拽或顺序变化时触发 React 更新（跟手用 DOM transform）
      if (becameMoved || orderChanged) {
        const next: DragSession = {
          ...s,
          order: s.order,
          lastClientX: e.clientX,
          moved: true,
        }
        sessionRef.current = next
        setSession(next)
      } else {
        syncDragTransform(e.clientX)
      }
    }

    const onUp = (e: PointerEvent) => {
      const s = sessionRef.current
      if (!s || e.pointerId !== s.pointerId) return
      sessionRef.current = null
      setSession(null)
      clearDragStyles()

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
  }, [insertIndexAt, listRef, snapshotLefts, syncDragTransform])

  const onPointerDown = useCallback((id: DesktopAppId, e: ReactPointerEvent) => {
    if (e.button !== 0) return
    const target = (e.currentTarget as HTMLElement).closest('[data-taskbar-app-id]') as Nullable<HTMLElement>
    if (!target) return
    e.preventDefault()
    const order = itemsRef.current.map((i) => i.id)
    const rect = target.getBoundingClientRect()
    const next: DragSession = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      grabOffsetX: e.clientX - rect.left,
      lastClientX: e.clientX,
      moved: false,
      order,
    }
    sessionRef.current = next
    setSession(next)
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }, [])

  return {
    displayOrder,
    draggingId: session?.moved ? session.id : null,
    onPointerDown,
  }
}
