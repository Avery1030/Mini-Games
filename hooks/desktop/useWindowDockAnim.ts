'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import {
  WINDOW_ANIM_MS,
  WINDOW_ANIM_S,
  afterPaint,
  maximizedSize,
  resolveDockPose,
  type MinAnim,
  type WindowPose,
} from '@/lib/desktop/windowGeometry'
import { setTaskbarAppAnimating } from '@/lib/desktop/dockPose'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

type Point = { x: number; y: number }
type Size = { width: number; height: number }

type UseWindowDockAnimOptions = {
  id?: string
  minimized: boolean
  maximized: boolean
  position: Point
  size: Size
  positionRef: MutableRefObject<Point>
  sizeRef: MutableRefObject<Size>
  beforeMaximizeRef: MutableRefObject<{ position: Point; size: Size }>
  setPosition: Dispatch<SetStateAction<Point>>
  setSize: Dispatch<SetStateAction<Size>>
  setMaximized: Dispatch<SetStateAction<boolean>>
  emitBounds: (next?: { position: Point; size: Size; maximized: boolean }) => void
  interactivelyMoving: boolean
  initialDockPose: WindowPose | null
}

/**
 * 最小化飞向任务栏；最大化在当前位置与全屏之间直接过渡。
 */
export function useWindowDockAnim({
  id,
  minimized,
  maximized,
  position,
  size,
  positionRef,
  sizeRef,
  beforeMaximizeRef,
  setPosition,
  setSize,
  setMaximized,
  emitBounds,
  interactivelyMoving,
  initialDockPose,
}: UseWindowDockAnimOptions) {
  const [geometryAnimating, setGeometryAnimating] = useState(false)
  const [minAnim, setMinAnim] = useState<MinAnim>(minimized ? 'hidden' : 'shown')
  const [poseOverride, setPoseOverride] = useState<WindowPose | null>(initialDockPose)

  const markTaskbar = (on: boolean) => {
    if (id) setTaskbarAppAnimating(id, on)
  }

  useEffect(() => {
    if (minimized) {
      setMinAnim((prev) => (prev === 'hidden' || prev === 'hiding' ? prev : 'hiding'))
    } else {
      setMinAnim((prev) => (prev === 'shown' || prev === 'showing' ? prev : 'showing'))
    }
  }, [minimized])

  useEffect(() => {
    if (minAnim !== 'hiding') return
    const s = sizeRef.current
    const p = positionRef.current
    const dock = resolveDockPose(id, s.width, s.height)
    markTaskbar(true)
    setPoseOverride({ x: p.x, y: p.y, scale: 1, opacity: 1 })
    const cancelPaint = afterPaint(() => setPoseOverride(dock))
    const timer = window.setTimeout(() => {
      setMinAnim('hidden')
      markTaskbar(false)
    }, WINDOW_ANIM_MS)
    return () => {
      cancelPaint()
      window.clearTimeout(timer)
      markTaskbar(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minAnim, id])

  useEffect(() => {
    if (minAnim !== 'showing') return
    const s = sizeRef.current
    const p = positionRef.current
    const dock = resolveDockPose(id, s.width, s.height)
    markTaskbar(true)
    setPoseOverride(dock)
    const cancelPaint = afterPaint(() => {
      setPoseOverride({ x: p.x, y: p.y, scale: 1, opacity: 1 })
    })
    const timer = window.setTimeout(() => {
      setMinAnim('shown')
      setPoseOverride(null)
      markTaskbar(false)
    }, WINDOW_ANIM_MS)
    return () => {
      cancelPaint()
      window.clearTimeout(timer)
      markTaskbar(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minAnim, id])

  const handleMaximize = () => {
    setGeometryAnimating(true)
    window.setTimeout(() => setGeometryAnimating(false), WINDOW_ANIM_MS)

    if (maximized) {
      const restored = beforeMaximizeRef.current
      setMaximized(false)
      setPosition(restored.position)
      setSize(restored.size)
      setPoseOverride(null)
      emitBounds({
        position: restored.position,
        size: restored.size,
        maximized: false,
      })
      return
    }

    beforeMaximizeRef.current = { position: { ...position }, size: { ...size } }
    const full = maximizedSize()
    setMaximized(true)
    setPosition({ x: 0, y: 0 })
    setSize(full)
    setPoseOverride(null)
    emitBounds({
      position: beforeMaximizeRef.current.position,
      size: beforeMaximizeRef.current.size,
      maximized: true,
    })
  }

  const fullyHidden = minAnim === 'hidden'
  const liveX = poseOverride?.x ?? position.x
  const liveY = poseOverride?.y ?? position.y
  const liveScale = poseOverride?.scale ?? 1
  const liveOpacity = poseOverride?.opacity ?? 1
  const chromeBusy = geometryAnimating || minAnim === 'hiding' || minAnim === 'showing'

  let transition: string | undefined
  if (!interactivelyMoving) {
    if (minAnim === 'hiding' || minAnim === 'showing') {
      transition = `transform ${WINDOW_ANIM_S} cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${WINDOW_ANIM_S} ease-out`
    } else if (geometryAnimating) {
      transition = `width ${WINDOW_ANIM_S} cubic-bezier(0.2, 0.8, 0.2, 1), height ${WINDOW_ANIM_S} cubic-bezier(0.2, 0.8, 0.2, 1), transform ${WINDOW_ANIM_S} cubic-bezier(0.2, 0.8, 0.2, 1)`
    } else if (poseOverride != null) {
      transition = `transform ${WINDOW_ANIM_S} cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${WINDOW_ANIM_S} ease-out`
    } else {
      transition = 'background-color 0.2s, border-color 0.2s'
    }
  }

  const frameStyle: CSSProperties = {
    left: 0,
    top: 0,
    transform: `translate3d(${liveX}px, ${liveY}px, 0) scale(${liveScale})`,
    transformOrigin: 'center center',
    width: size.width,
    height: size.height,
    opacity: liveOpacity,
    willChange:
      interactivelyMoving || geometryAnimating || minAnim === 'hiding' || minAnim === 'showing'
        ? 'transform, width, height, opacity'
        : undefined,
    pointerEvents: minAnim === 'hiding' || minAnim === 'showing' ? 'none' : 'auto',
    transition,
  }

  return {
    handleMaximize,
    chromeBusy,
    frameStyle,
    /** 最小化动画结束后为 true；调用方应 return null，避免最小化窗口留在 DOM */
    fullyHidden,
  }
}
