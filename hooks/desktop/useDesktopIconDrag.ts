'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import {
  DBLCLICK_MS,
  DRAG_THRESHOLD,
  diffCoordinates,
  positionToCoordinate,
  previewPlacement,
} from '@/lib/desktop'

type CoordApp = { id: DesktopAppId; coordinate: DesktopCoordinate }

type DragSession = {
  id: DesktopAppId
  pointerId: number
  startX: number
  startY: number
  /** 指针相对图标左上角（viewport） */
  offsetX: number
  offsetY: number
  moved: boolean
}

type UseDesktopIconDragOptions = {
  apps: CoordApp[]
  desktopRef: RefObject<HTMLDivElement | null>
  onOpen: (id: DesktopAppId) => void
  onCommit: (updates: Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }>) => void
  /**
   * 拖放到某点时优先处理（如丢进回收站 / 文件夹）。
   * 返回 true 表示已消费，不再提交格点坐标。
   */
  onDropAtPoint?: (draggedId: DesktopAppId, clientX: number, clientY: number) => boolean
  /** 指针下的命中目标是否可作为投放区（高亮 + 取消格点预览） */
  isDropTarget?: (id: DesktopAppId) => boolean
}

/** 指针下命中的桌面图标 id（跳过正在拖拽的自身） */
export function hitDesktopIconAtPoint(
  clientX: number,
  clientY: number,
  ignoreId?: DesktopAppId,
): DesktopAppId | null {
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
  onDropAtPoint,
  isDropTarget,
}: UseDesktopIconDragOptions) {
  const appsRef = useRef(apps)
  appsRef.current = apps
  const sessionRef = useRef<DragSession | null>(null)
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onDropAtPointRef = useRef(onDropAtPoint)
  onDropAtPointRef.current = onDropAtPoint
  const isDropTargetRef = useRef(isDropTarget)
  isDropTargetRef.current = isDropTarget

  const [draggingId, setDraggingId] = useState<DesktopAppId | null>(null)
  /** fixed 定位时的 viewport 坐标 */
  const [dragPixel, setDragPixel] = useState<{ left: number; top: number } | null>(null)
  const [previewCoords, setPreviewCoords] = useState<Map<DesktopAppId, DesktopCoordinate> | null>(
    null,
  )
  /** 拖拽悬停的投放目标（回收站 / 文件夹） */
  const [dropTargetId, setDropTargetId] = useState<DesktopAppId | null>(null)
  /** 用于双击打开：记录上一次未拖拽的点击 */
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

  const updatePreviewFromIconViewport = useCallback(
    (id: DesktopAppId, viewportLeft: number, viewportTop: number, clientX: number, clientY: number) => {
      const hit = hitDesktopIconAtPoint(clientX, clientY, id)
      const canDrop = hit != null && isDropTargetRef.current?.(hit) === true
      setDropTargetId(canDrop ? hit : null)

      // 悬停投放目标时不预览格点让位
      if (canDrop) {
        setPreviewCoords(null)
        return
      }

      const local = desktopLocalFromViewport(viewportLeft, viewportTop)
      const target = positionToCoordinate(local.left, local.top)
      setPreviewCoords(previewPlacement(appsRef.current, id, target))
    },
    [desktopLocalFromViewport],
  )

  const endDrag = useCallback(
    (viewportLeft: number, viewportTop: number, clientX: number, clientY: number, commit: boolean) => {
      const session = sessionRef.current
      sessionRef.current = null
      if (!session) return

      if (!session.moved) {
        // 单击不打开；同一图标在时间窗口内点第二次才打开（Win 经典行为）
        const now = Date.now()
        const last = lastClickRef.current
        if (last && last.id === session.id && now - last.time <= DBLCLICK_MS) {
          onOpenRef.current(session.id)
          lastClickRef.current = null
        } else {
          lastClickRef.current = { id: session.id, time: now }
        }
        setDraggingId(null)
        setDragPixel(null)
        setPreviewCoords(null)
        setDropTargetId(null)
        return
      }

      lastClickRef.current = null

      if (commit) {
        const handled = onDropAtPointRef.current?.(session.id, clientX, clientY) === true
        if (!handled) {
          const local = desktopLocalFromViewport(viewportLeft, viewportTop)
          const target = positionToCoordinate(local.left, local.top)
          const next = previewPlacement(appsRef.current, session.id, target)
          const updates = diffCoordinates(appsRef.current, next, session.id)
          if (updates.length > 0) {
            onCommitRef.current(updates)
          }
        }
      }

      setDraggingId(null)
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

      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY

      if (!session.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        session.moved = true
        setDraggingId(session.id)
      }

      const left = e.clientX - session.offsetX
      const top = e.clientY - session.offsetY
      setDragPixel({ left, top })
      updatePreviewFromIconViewport(session.id, left, top, e.clientX, e.clientY)
    }

    const onUp = (e: globalThis.PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      const left = e.clientX - session.offsetX
      const top = e.clientY - session.offsetY
      endDrag(left, top, e.clientX, e.clientY, true)
    }

    const onCancel = () => {
      const session = sessionRef.current
      if (!session) return
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
  }, [endDrag, updatePreviewFromIconViewport])

  const handleIconPointerDown = useCallback((id: DesktopAppId, e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    const iconRect = e.currentTarget.getBoundingClientRect()
    sessionRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - iconRect.left,
      offsetY: e.clientY - iconRect.top,
      moved: false,
    }
  }, [])

  return {
    draggingId,
    dragPixel,
    previewCoords,
    dropTargetId,
    handleIconPointerDown,
  }
}
