'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import {
  DBLCLICK_MS,
  DRAG_THRESHOLD,
  diffCoordinates,
  positionToCoordinate,
  previewPlacement,
  hitFsDropTarget,
  type FsDropTarget,
} from '@/lib/desktop'
import { allocateDesktopCoordinate } from '@/lib/desktop/window'

type CoordApp = { id: DesktopAppId; coordinate: DesktopCoordinate }

type DragSession = {
  id: DesktopAppId
  ids: DesktopAppId[]
  pointerId: number
  startX: number
  startY: number
  offsetX: number
  offsetY: number
  moved: boolean
  copy: boolean
  /** 按下时的修饰键，供单击选择逻辑使用 */
  metaKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
}

export type FsDropResult = {
  ids: DesktopAppId[]
  target: FsDropTarget
  copy: boolean
  clientX: number
  clientY: number
  primaryViewportLeft: number
  primaryViewportTop: number
}

type UseDesktopIconDragOptions = {
  apps: CoordApp[]
  desktopRef: RefObject<HTMLDivElement | null>
  onOpen: (id: DesktopAppId) => void
  onCommit: (updates: Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }>) => void
  resolveDragIds?: (id: DesktopAppId) => DesktopAppId[]
  onFsDrop?: (result: FsDropResult) => boolean
  isIconDropTarget?: (id: DesktopAppId) => boolean
  /** 未拖动的单击（含修饰键） */
  onItemClick?: (id: DesktopAppId, e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }) => void
  /** 超过拖拽阈值时同步选区（多选拖拽视觉反馈） */
  onDragStart?: (ids: DesktopAppId[]) => void
}

export function hitDesktopIconAtPoint(clientX: number, clientY: number, ignoreId?: DesktopAppId): DesktopAppId | null {
  if (typeof document === 'undefined') return null
  const els = document.elementsFromPoint(clientX, clientY)
  for (const el of els) {
    const host = (el as Element).closest?.('[data-desktop-icon]') as HTMLElement | null
    if (!host) continue
    const id = host.dataset.desktopIcon as DesktopAppId | undefined
    if (!id || id === ignoreId) continue
    return id
  }
  return null
}

export function useDesktopIconDrag({
  apps,
  desktopRef,
  onOpen,
  onCommit,
  resolveDragIds,
  onFsDrop,
  isIconDropTarget,
  onItemClick,
  onDragStart,
}: UseDesktopIconDragOptions) {
  const appsRef = useRef(apps)
  appsRef.current = apps
  const sessionRef = useRef<DragSession | null>(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const resolveDragIdsRef = useRef(resolveDragIds)
  resolveDragIdsRef.current = resolveDragIds
  const onFsDropRef = useRef(onFsDrop)
  onFsDropRef.current = onFsDrop
  const isIconDropTargetRef = useRef(isIconDropTarget)
  isIconDropTargetRef.current = isIconDropTarget
  const onItemClickRef = useRef(onItemClick)
  onItemClickRef.current = onItemClick
  const onDragStartRef = useRef(onDragStart)
  onDragStartRef.current = onDragStart

  const [draggingId, setDraggingId] = useState<DesktopAppId | null>(null)
  const [draggingIds, setDraggingIds] = useState<DesktopAppId[]>([])
  const [dragPixel, setDragPixel] = useState<{ left: number; top: number } | null>(null)
  const [previewCoords, setPreviewCoords] = useState<Map<DesktopAppId, DesktopCoordinate> | null>(null)
  const [dropTargetId, setDropTargetId] = useState<DesktopAppId | null>(null)
  const lastClickRef = useRef<{ id: DesktopAppId; time: number } | null>(null)

  const desktopLocalFromViewport = useCallback(
    (viewportLeft: number, viewportTop: number) => {
      const desktop = desktopRef.current
      if (!desktop) return { left: viewportLeft, top: viewportTop }
      const rect = desktop.getBoundingClientRect()
      const style = getComputedStyle(desktop)
      const padL = parseFloat(style.paddingLeft) || 0
      const padT = parseFloat(style.paddingTop) || 0
      return {
        left: viewportLeft - rect.left - padL,
        top: viewportTop - rect.top - padT,
      }
    },
    [desktopRef],
  )

  const updateHover = useCallback(
    (ids: DesktopAppId[], viewportLeft: number, viewportTop: number, clientX: number, clientY: number) => {
      const ignore = new Set(ids)
      const fsTarget = hitFsDropTarget(clientX, clientY, ignore)

      const iconHit = hitDesktopIconAtPoint(clientX, clientY, ids[0])
      const iconOk = iconHit != null && !ignore.has(iconHit) && isIconDropTargetRef.current?.(iconHit) === true
      setDropTargetId(iconOk ? iconHit : null)

      const dropBlocksYield = iconOk || (fsTarget != null && fsTarget.type !== 'desktop')
      if (dropBlocksYield) {
        setPreviewCoords(null)
        return
      }

      const local = desktopLocalFromViewport(viewportLeft, viewportTop)
      const target = positionToCoordinate(local.left, local.top)
      setPreviewCoords(previewPlacement(appsRef.current, ids[0]!, target))
    },
    [desktopLocalFromViewport],
  )

  const endDrag = useCallback(
    (viewportLeft: number, viewportTop: number, clientX: number, clientY: number, commit: boolean) => {
      const session = sessionRef.current
      sessionRef.current = null
      if (!session) return

      if (!session.moved) {
        onItemClickRef.current?.(session.id, {
          metaKey: session.metaKey,
          ctrlKey: session.ctrlKey,
          shiftKey: session.shiftKey,
        })
        const now = Date.now()
        const last = lastClickRef.current
        if (
          !session.metaKey &&
          !session.ctrlKey &&
          !session.shiftKey &&
          last &&
          last.id === session.id &&
          now - last.time <= DBLCLICK_MS
        ) {
          onOpenRef.current(session.id)
          lastClickRef.current = null
        } else if (!session.metaKey && !session.ctrlKey && !session.shiftKey) {
          lastClickRef.current = { id: session.id, time: now }
        } else {
          lastClickRef.current = null
        }
        setDraggingId(null)
        setDraggingIds([])
        setDragPixel(null)
        setPreviewCoords(null)
        setDropTargetId(null)
        return
      }

      lastClickRef.current = null

      if (commit) {
        const ignore = new Set(session.ids)
        const fsTarget = hitFsDropTarget(clientX, clientY, ignore)
        let handled = false
        if (fsTarget) {
          handled =
            onFsDropRef.current?.({
              ids: session.ids,
              target: fsTarget,
              copy: session.copy,
              clientX,
              clientY,
              primaryViewportLeft: viewportLeft,
              primaryViewportTop: viewportTop,
            }) === true
        }
        if (!handled) {
          const desktopIds = new Set(appsRef.current.map((a) => a.id))
          if (desktopIds.has(session.id)) {
            const local = desktopLocalFromViewport(viewportLeft, viewportTop)
            const target = positionToCoordinate(local.left, local.top)
            const next = previewPlacement(appsRef.current, session.id, target)
            const others = session.ids.filter((id) => id !== session.id && desktopIds.has(id))
            if (others.length > 0) {
              const occupied: DesktopCoordinate[] = []
              for (const [id, coord] of next) {
                if (!others.includes(id)) occupied.push(coord)
              }
              let prefer = next.get(session.id) ?? target
              for (const id of others) {
                const coord = allocateDesktopCoordinate(occupied, prefer)
                next.set(id, coord)
                occupied.push(coord)
                prefer = coord
              }
            }
            const updates = diffCoordinates(appsRef.current, next, session.id)
            if (updates.length > 0) onCommitRef.current(updates)
          }
        }
      }

      setDraggingId(null)
      setDraggingIds([])
      setDragPixel(null)
      setPreviewCoords(null)
      setDropTargetId(null)
    },
    [desktopLocalFromViewport],
  )

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      session.copy = e.altKey

      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY
      if (!session.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        session.moved = true
        setDraggingId(session.id)
        setDraggingIds(session.ids)
        onDragStartRef.current?.(session.ids)
      }

      const left = e.clientX - session.offsetX
      const top = e.clientY - session.offsetY
      setDragPixel({ left, top })
      updateHover(session.ids, left, top, e.clientX, e.clientY)
    }

    const onUp = (e: globalThis.PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      session.copy = e.altKey
      endDrag(e.clientX - session.offsetX, e.clientY - session.offsetY, e.clientX, e.clientY, true)
    }

    const onCancel = () => {
      if (!sessionRef.current) return
      endDrag(0, 0, 0, 0, false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [endDrag, updateHover])

  const handleIconPointerDown = useCallback((id: DesktopAppId, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    const ids = resolveDragIdsRef.current?.(id) ?? [id]
    const iconRect = e.currentTarget.getBoundingClientRect()
    sessionRef.current = {
      id,
      ids,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - iconRect.left,
      offsetY: e.clientY - iconRect.top,
      moved: false,
      copy: e.altKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
    }
  }, [])

  return {
    draggingId,
    draggingIds,
    dragPixel,
    previewCoords,
    dropTargetId,
    handleIconPointerDown,
  }
}
