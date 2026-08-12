import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  MOVE_ANIM_MS,
  createStaticLayer,
  drawSokobanBoard,
  facingFromDelta,
  interpolateVisual,
  setupBoardCanvas,
  visualFromState,
  type BoardVisual,
} from './boardCanvas'
import type { LevelData, SokobanState } from './types'

/** Canvas 绘制与移动过渡 */
export function useBoardAnim(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const visualRef = useRef<BoardVisual | null>(null)
  const animFromRef = useRef<BoardVisual | null>(null)
  const animToRef = useRef<BoardVisual | null>(null)
  const animStartRef = useRef(0)
  const rafRef = useRef(0)
  const staticLayerRef = useRef<HTMLCanvasElement | null>(null)
  const staticKeyRef = useRef('')
  const levelIdForAnimRef = useRef<number | null>(null)
  const cellPxRef = useRef(32)
  const stateRef = useRef<SokobanState | null>(null)

  const paint = useCallback((visual: BoardVisual, level: LevelData, cell: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = setupBoardCanvas(canvas, level, cell)
    if (!ctx) return

    const key = `${level.width}x${level.height}:${cell}:${level.map.join('\n')}`
    if (staticKeyRef.current !== key) {
      staticLayerRef.current = createStaticLayer(level, cell)
      staticKeyRef.current = key
    }

    drawSokobanBoard(ctx, {
      level,
      visual,
      cellPx: cell,
      staticLayer: staticLayerRef.current,
    })
  }, [canvasRef])

  const stopAnim = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const runAnimFrame = useCallback(() => {
    const cur = stateRef.current
    const from = animFromRef.current
    const to = animToRef.current
    if (!cur || !from || !to) return

    const elapsed = performance.now() - animStartRef.current
    const t = Math.min(1, elapsed / MOVE_ANIM_MS)
    const visual = interpolateVisual(from, to, t)
    visualRef.current = visual
    paint(visual, cur.level, cellPxRef.current)

    if (t < 1) {
      rafRef.current = requestAnimationFrame(runAnimFrame)
    } else {
      visualRef.current = to
      animFromRef.current = null
      animToRef.current = null
      rafRef.current = 0
    }
  }, [paint])

  const startMoveAnim = useCallback(
    (next: SokobanState, snap: boolean) => {
      const prevFacing = visualRef.current?.facing ?? 'down'
      const facing = snap
        ? ('down' as const)
        : visualRef.current
          ? facingFromDelta(visualRef.current.player, next.player, prevFacing)
          : prevFacing
      const target = visualFromState(next.player, next.boxes, next.level.targets, facing)
      stopAnim()

      if (snap || !visualRef.current) {
        visualRef.current = target
        animFromRef.current = null
        animToRef.current = null
        paint(target, next.level, cellPxRef.current)
        return
      }

      animFromRef.current = visualRef.current
      animToRef.current = target
      animStartRef.current = performance.now()
      rafRef.current = requestAnimationFrame(runAnimFrame)
    },
    [paint, runAnimFrame, stopAnim],
  )

  const startMoveAnimRef = useRef(startMoveAnim)
  startMoveAnimRef.current = startMoveAnim

  const syncState = useCallback((state: SokobanState | null, cellPx: number) => {
    stateRef.current = state
    cellPxRef.current = cellPx
  }, [])

  const onStateChanged = useCallback((state: SokobanState) => {
    const levelChanged = levelIdForAnimRef.current !== state.levelId
    levelIdForAnimRef.current = state.levelId
    startMoveAnimRef.current(state, levelChanged)
  }, [])

  const repaintForCellPx = useCallback(
    (cellPx: number) => {
      const cur = stateRef.current
      const visual = visualRef.current
      if (!cur || !visual) return
      staticKeyRef.current = ''
      paint(visual, cur.level, cellPx)
    },
    [paint],
  )

  useEffect(() => () => stopAnim(), [stopAnim])

  return {
    stateRef,
    cellPxRef,
    visualRef,
    syncState,
    onStateChanged,
    repaintForCellPx,
    stopAnim,
  }
}
