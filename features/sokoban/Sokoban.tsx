'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { Select } from '@/components/ui'
import { BOARD, MOVE_ANIM_MS, createStaticLayer, drawSokobanBoard, facingFromDelta, interpolateVisual, setupBoardCanvas, visualFromState, type BoardVisual } from './boardCanvas'
import { boxOnTarget, createStateFromLevel, resetLevel, tryMove, undoMove } from './game'
import { fetchAllLevels, type LoadedLevels } from './loadLevels'
import type { Direction, SokobanState } from './types'

export interface SokobanProps {
  embedded?: boolean
  onClose?: () => void
}

const MOVE_COOLDOWN_MS = MOVE_ANIM_MS
const CELL_MIN = 24
const CELL_MAX = 48

function keyToDir(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up'
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down'
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left'
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right'
    default:
      return null
  }
}

function pad3(n: number): string {
  return String(Math.max(0, Math.min(999, n))).padStart(3, '0')
}

function LcdStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className='flex flex-col items-center gap-0.5 min-w-[52px]'>
      <span className='text-[10px] text-muted leading-none'>{label}</span>
      <div
        className={cn(
          'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          'px-1.5 py-0.5 font-mono text-sm tracking-wider tabular-nums leading-none',
          accent
            ? 'bg-[#0f2410] text-[#4dff7a] dark:bg-[#0a1f0c] dark:text-[#5dff88]'
            : 'bg-[#1a1a1a] text-[#ff4040] dark:bg-[#0d0d0d] dark:text-[#ff5555]',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DpadButton({
  label,
  pressed,
  onPress,
  className,
  children,
}: {
  label: string
  pressed: boolean
  onPress: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type='button'
      aria-label={label}
      className={cn(
        pressed ? winChromePressed : winChrome,
        'h-10 w-11 text-base font-bold select-none touch-manipulation',
        className,
      )}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
    >
      {children}
    </button>
  )
}

/**
 * 推箱子：Canvas 棋盘 + 键盘/屏幕方向键，关卡见 levels.ts。
 */
export function Sokoban({ embedded = false, onClose }: SokobanProps = {}) {
  const t = useTranslations('sokoban')

  const boardHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastMoveAtRef = useRef(0)
  const stateRef = useRef<SokobanState | null>(null)
  const bundleRef = useRef<LoadedLevels | null>(null)
  const visualRef = useRef<BoardVisual | null>(null)
  const animFromRef = useRef<BoardVisual | null>(null)
  const animToRef = useRef<BoardVisual | null>(null)
  const animStartRef = useRef(0)
  const rafRef = useRef(0)
  const staticLayerRef = useRef<HTMLCanvasElement | null>(null)
  const staticKeyRef = useRef('')
  const levelIdForAnimRef = useRef<number | null>(null)
  const cellPxRef = useRef(32)

  const [catalog, setCatalog] = useState<number[]>([])
  const [levelId, setLevelId] = useState<number | null>(null)
  const [state, setState] = useState<SokobanState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cellPx, setCellPx] = useState(32)
  const [heldDir, setHeldDir] = useState<Direction | null>(null)

  stateRef.current = state
  cellPxRef.current = cellPx

  const paint = useCallback((visual: BoardVisual, level: SokobanState['level'], cell: number) => {
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
  }, [])

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

  /** 把焦点从关卡 Select 收回游戏区，避免方向键再次打开下拉 */
  const focusGame = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      const active = document.activeElement
      if (active !== root && root.contains(active)) {
        active.blur()
      }
    }
    root.focus({ preventScroll: true })
  }, [])

  const selectLevel = useCallback(
    (id: number) => {
      const bundle = bundleRef.current
      if (!bundle) return
      const level = bundle.byId.get(id)
      if (!level) {
        setLoadError('loadFailed')
        return
      }
      setLevelId(id)
      setState(createStateFromLevel(id, level))
      setLoadError(null)
      requestAnimationFrame(() => focusGame())
    },
    [focusGame],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const bundle = await fetchAllLevels()
        if (cancelled) return
        bundleRef.current = bundle
        setCatalog(bundle.ids)
        const first = bundle.ids[0]
        if (first != null) {
          setLevelId(first)
          setState(createStateFromLevel(first, bundle.byId.get(first)!))
        }
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'loadFailed')
        setState(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const host = boardHostRef.current
    if (!host || !state) return

    const update = () => {
      const pad = 20
      const availW = Math.max(0, host.clientWidth - pad)
      const availH = Math.max(0, host.clientHeight - pad)
      const byW = Math.floor(availW / state.level.width)
      const byH = Math.floor(availH / state.level.height)
      const next = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.min(byW, byH)))
      setCellPx(next)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [state])

  // 状态变化 → 过渡 / 换关瞬切
  useEffect(() => {
    if (!state) return
    const levelChanged = levelIdForAnimRef.current !== state.levelId
    levelIdForAnimRef.current = state.levelId
    startMoveAnimRef.current(state, levelChanged)
  }, [state])

  useEffect(() => () => stopAnim(), [stopAnim])

  // cellPx 变化时重建静态层并按当前视觉位置重绘
  useEffect(() => {
    const cur = stateRef.current
    const visual = visualRef.current
    if (!cur || !visual) return
    staticKeyRef.current = ''
    paint(visual, cur.level, cellPx)
  }, [cellPx, paint])

  const applyMove = useCallback(
    (dir: Direction) => {
      focusGame()
      const now = Date.now()
      if (now - lastMoveAtRef.current < MOVE_COOLDOWN_MS) return
      const cur = stateRef.current
      if (!cur || cur.won) return
      const next = tryMove(cur, dir)
      if (next === cur) return
      lastMoveAtRef.current = now
      setState(next)
    },
    [focusGame],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setState((prev) => (prev ? undoMove(prev) : prev))
        return
      }
      const dir = keyToDir(e.key)
      if (!dir) return

      const ae = document.activeElement
      if (ae instanceof HTMLElement && ae.getAttribute('aria-expanded') === 'true') {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      focusGame()
      setHeldDir(dir)
      applyMove(dir)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key)
      if (dir) setHeldDir((prev) => (prev === dir ? null : prev))
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [applyMove, focusGame])

  useEffect(() => {
    const clear = () => setHeldDir(null)
    window.addEventListener('blur', clear)
    window.addEventListener('pointerup', clear)
    window.addEventListener('pointercancel', clear)
    return () => {
      window.removeEventListener('blur', clear)
      window.removeEventListener('pointerup', clear)
      window.removeEventListener('pointercancel', clear)
    }
  }, [])

  const onSelectLevel = useCallback(
    (id: string) => {
      const n = Number(id)
      if (!Number.isFinite(n)) return
      selectLevel(n)
    },
    [selectLevel],
  )

  const goAdjacentLevel = useCallback(
    (delta: number) => {
      if (catalog.length === 0 || levelId == null) return
      const idx = catalog.indexOf(levelId)
      if (idx < 0) return
      const next = catalog[(idx + delta + catalog.length) % catalog.length]
      if (next != null) selectLevel(next)
    },
    [catalog, levelId, selectLevel],
  )

  const onUndo = useCallback(() => {
    setState((prev) => (prev ? undoMove(prev) : prev))
  }, [])

  const onReset = useCallback(() => {
    setState((prev) => (prev ? resetLevel(prev) : prev))
  }, [])

  const placedCount = useMemo(() => {
    if (!state) return 0
    return state.boxes.filter((b) => boxOnTarget(b, state.level.targets)).length
  }, [state])

  const selectOptions = catalog.map((id) => ({
    value: String(id),
    label: t('levelN', { n: id }),
  }))

  return (
    <div
      ref={rootRef}
      className={cn(
        embeddedAppShell(embedded, 'relative flex flex-col bg-chrome text-on-chrome min-h-0'),
        'overflow-hidden h-full outline-none',
      )}
      tabIndex={0}
    >
      {/* 顶栏：状态 + 关卡切换 */}
      <div className={cn(winChrome, 'mx-2 mt-2 px-2 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 shrink-0')}>
        <div className='flex items-center gap-2 shrink-0'>
          <LcdStat label={t('moves')} value={pad3(state?.moves ?? 0)} />
          <LcdStat
            label={t('placed')}
            value={`${pad3(placedCount).slice(-2)}/${pad3(state?.level.targets.length ?? 0).slice(-2)}`}
            accent={!!state && placedCount === state.level.targets.length && state.level.targets.length > 0}
          />
        </div>

        <div className='hidden sm:block h-7 w-px shrink-0 bg-on-chrome/15' />

        <div className='flex items-center gap-1 shrink-0'>
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-7 shrink-0 inline-flex items-center justify-center disabled:opacity-40')}
            disabled={catalog.length < 2 || loading}
            aria-label={t('prevLevel')}
            onClick={() => goAdjacentLevel(-1)}
          >
            <ChevronLeft size={14} aria-hidden />
          </button>
          <Select
            size='md'
            className='w-[8rem] shrink-0'
            aria-label={t('level')}
            value={levelId == null ? '' : String(levelId)}
            disabled={loading || catalog.length === 0}
            onValueChange={onSelectLevel}
            options={selectOptions}
          />
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-7 shrink-0 inline-flex items-center justify-center disabled:opacity-40')}
            disabled={catalog.length < 2 || loading}
            aria-label={t('nextLevel')}
            onClick={() => goAdjacentLevel(1)}
          >
            <ChevronRight size={14} aria-hidden />
          </button>
        </div>

        <div className='flex items-center gap-1 shrink-0 sm:ml-auto'>
          <button
            type='button'
            className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-40')}
            disabled={!state || state.undoStack.length === 0 || state.won}
            onClick={onUndo}
          >
            <Undo2 size={12} aria-hidden />
            {t('undo')}
          </button>
          <button
            type='button'
            className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-40')}
            disabled={!state}
            onClick={onReset}
          >
            <RotateCcw size={12} aria-hidden />
            {t('reset')}
          </button>
          {onClose ? (
            <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onClose}>
              {t('close')}
            </button>
          ) : null}
        </div>
      </div>

      {/* 棋盘（Canvas） */}
      <div ref={boardHostRef} className='flex-1 min-h-0 flex items-center justify-center px-2 py-2 overflow-hidden'>
        {loading ? (
          <p className='text-xs text-muted'>{t('loading')}</p>
        ) : loadError ? (
          <p className='text-xs text-red-700 dark:text-red-400 px-4 text-center'>{t('loadFailed')}</p>
        ) : state ? (
          <div
            className={cn(winChromeSunken, 'relative shrink-0 p-1.5')}
            style={{
              width: state.level.width * cellPx + 12,
              height: state.level.height * cellPx + 12,
              background: BOARD.void,
            }}
            role='application'
            aria-label={t('boardLabel')}
          >
            <canvas
              ref={canvasRef}
              className='block'
              aria-label={t('player')}
            />
          </div>
        ) : null}
      </div>

      {/* 方向键 */}
      <div className='shrink-0 px-2 pb-1 flex flex-col items-center gap-1'>
        <DpadButton label={t('dirUp')} pressed={heldDir === 'up'} onPress={() => applyMove('up')}>
          ↑
        </DpadButton>
        <div className='flex items-center gap-1'>
          <DpadButton label={t('dirLeft')} pressed={heldDir === 'left'} onPress={() => applyMove('left')}>
            ←
          </DpadButton>
          <div className={cn(winChromePressed, 'h-10 w-11 opacity-60 pointer-events-none')} aria-hidden />
          <DpadButton label={t('dirRight')} pressed={heldDir === 'right'} onPress={() => applyMove('right')}>
            →
          </DpadButton>
        </div>
        <DpadButton label={t('dirDown')} pressed={heldDir === 'down'} onPress={() => applyMove('down')}>
          ↓
        </DpadButton>
      </div>

      <p className='shrink-0 px-3 pb-1.5 text-[10px] text-muted text-center truncate'>{t('hint')}</p>

      {state?.won ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 p-4'>
          <div
            className={cn(
              winChrome,
              'bg-chrome text-on-chrome px-5 py-4 min-w-[240px] max-w-[90%] text-center shadow-lg',
            )}
          >
            <p className='text-lg font-bold mb-1 text-green-800 dark:text-green-400'>{t('won')}</p>
            <p className='text-xs text-muted mb-1'>{t('wonHint')}</p>
            <div className='my-3 flex justify-center gap-3'>
              <LcdStat label={t('moves')} value={pad3(state.moves)} />
              <LcdStat
                label={t('placed')}
                value={`${pad3(placedCount).slice(-2)}/${pad3(state.level.targets.length).slice(-2)}`}
                accent
              />
            </div>
            <div className='flex items-center justify-center gap-2 flex-wrap'>
              <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onReset}>
                {t('playAgain')}
              </button>
              {catalog.length > 1 ? (
                <button
                  type='button'
                  className={cn(winChrome, 'px-3 py-1.5 text-sm font-semibold')}
                  onClick={() => goAdjacentLevel(1)}
                >
                  {t('nextLevel')}
                </button>
              ) : null}
              {onClose ? (
                <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onClose}>
                  {t('close')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
