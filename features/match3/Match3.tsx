'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePanel, winChromeSunken } from '@/lib/winChrome'
import {
  animateClear,
  animateFall,
  animateSwap,
  boardToScene,
  buildIntroFalls,
  FALL_MS,
  GAP,
  hitTest,
  paintBoard,
  setupMatch3Canvas,
  type SceneBurst,
  type SceneTile,
} from './boardCanvas'
import {
  applySwap,
  canSwap,
  clearMatches,
  collapseAndFill,
  createInitialState,
  getLevel,
  goToLevel,
  hasAnyValidMove,
  isAdjacent,
  previewClear,
  reshuffleTiles,
  restartLevel,
  settleStatus,
} from './game'
import { MATCH3_LEVELS } from './levels'
import type { GameState, Pos, TileKind } from './types'

export interface Match3Props {
  embedded?: boolean
}

const HOST_PAD = 16
const FRAME_PAD = 12

function sleep(ms: number) {
  return new Promise<void>((r) => {
    window.setTimeout(r, ms)
  })
}

function posEq(a: Pos | null, b: Pos): boolean {
  return !!a && a.r === b.r && a.c === b.c
}

function posKey(p: Pos): string {
  return `${p.r},${p.c}`
}

function calcCellPx(hostW: number, hostH: number, rows: number, cols: number): number {
  const availW = Math.max(0, hostW - HOST_PAD - FRAME_PAD)
  const availH = Math.max(0, hostH - HOST_PAD - FRAME_PAD)
  const byW = Math.floor((availW - (cols - 1) * GAP) / cols)
  const byH = Math.floor((availH - (rows - 1) * GAP) / rows)
  return Math.max(28, Math.min(44, Math.min(byW, byH) || 36))
}

function boardSize(rows: number, cols: number, cellPx: number) {
  return {
    w: cols * cellPx + Math.max(0, cols - 1) * GAP,
    h: rows * cellPx + Math.max(0, rows - 1) * GAP,
  }
}

export function Match3({ embedded = false }: Match3Props = {}) {
  const t = useTranslations('match3')
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [busy, setBusy] = useState(false)
  const [cellPx, setCellPx] = useState(36)

  const boardHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const busyRef = useRef(false)
  const stateRef = useRef(state)
  const sceneRef = useRef<SceneTile[]>([])
  const burstsRef = useRef<SceneBurst[]>([])
  const cellPxRef = useRef(cellPx)
  const rafPaintRef = useRef(0)

  stateRef.current = state
  cellPxRef.current = cellPx

  const level = getLevel(state.levelId)
  const rows = state.board.length
  const cols = state.board[0]?.length ?? 0
  const { w: boardW, h: boardH } = boardSize(rows, cols, cellPx)
  const levelIndex = MATCH3_LEVELS.findIndex((l) => l.id === level.id)
  const levelOptions = useMemo(
    () => MATCH3_LEVELS.map((lv) => ({ value: String(lv.id), label: t('levelN', { n: lv.id }) })),
    [t],
  )

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const board = stateRef.current.board
    const r = board.length
    const c = board[0]?.length ?? 0
    const px = cellPxRef.current
    const st = px + GAP
    const { w, h } = boardSize(r, c, px)
    const ctx = setupMatch3Canvas(canvas, w, h)
    if (!ctx) return
    paintBoard(ctx, {
      rows: r,
      cols: c,
      cellPx: px,
      stride: st,
      cssW: w,
      cssH: h,
      tiles: sceneRef.current,
      bursts: burstsRef.current,
      now: performance.now(),
    })
  }, [])

  const requestPaint = useCallback(() => {
    if (rafPaintRef.current) cancelAnimationFrame(rafPaintRef.current)
    rafPaintRef.current = requestAnimationFrame(() => {
      rafPaintRef.current = 0
      paint()
    })
  }, [paint])

  const measureAndSetCellPx = useCallback((boardRows: number, boardCols: number) => {
    const host = boardHostRef.current
    if (!host) return cellPxRef.current
    const next = calcCellPx(host.clientWidth, host.clientHeight, boardRows, boardCols)
    cellPxRef.current = next
    setCellPx((p) => (p === next ? p : next))
    return next
  }, [])

  const syncSceneFromState = useCallback(
    (s: GameState) => {
      const px = cellPxRef.current
      sceneRef.current = boardToScene(s.board, s.obstacles, s.selected, px, px + GAP)
      requestPaint()
    },
    [requestPaint],
  )

  const runCascade = useCallback(
    async (start: GameState, focus?: Pos[]) => {
      let cur = start
      let focusArg = focus
      const px = cellPxRef.current
      const st = px + GAP

      for (;;) {
        for (;;) {
          const preview = previewClear(cur, focusArg)
          const thisFocus = focusArg
          focusArg = undefined
          if (!preview.length) break

          const clearMap = new Map<string, { r: number; c: number; kind: TileKind | 'brick' }>()
          for (const p of preview) {
            const cell = cur.board[p.r]?.[p.c]
            if (cell) clearMap.set(posKey(p), { r: p.r, c: p.c, kind: cell.kind })
            else if (cur.obstacles[p.r]?.[p.c]) {
              clearMap.set(posKey(p), { r: p.r, c: p.c, kind: 'brick' })
            }
          }

          await animateClear(sceneRef.current, burstsRef.current, clearMap, px, st, requestPaint)

          const { state: clearedState } = clearMatches(cur, thisFocus)
          setState(clearedState)
          sceneRef.current = boardToScene(
            clearedState.board,
            clearedState.obstacles,
            null,
            px,
            st,
          )
          requestPaint()

          const { state: fallen, falls } = collapseAndFill(clearedState)
          cur = fallen
          await animateFall(
            sceneRef.current,
            fallen.board,
            fallen.obstacles,
            falls,
            fallen.selected,
            px,
            st,
            requestPaint,
          )
          setState(fallen)
          await sleep(Math.min(40, FALL_MS / 8))
        }

        const ended = settleStatus(cur)
        if (ended.status !== 'playing') {
          setState(ended)
          syncSceneFromState(ended)
          return ended
        }
        if (hasAnyValidMove(ended.board, ended.obstacles)) {
          setState(ended)
          syncSceneFromState(ended)
          return ended
        }

        // 死局：自动重排宝石（障碍保留），若产生新匹配则继续连锁
        cur = reshuffleTiles(ended)
        setState(cur)
        syncSceneFromState(cur)
        await sleep(220)
        focusArg = undefined
      }
    },
    [requestPaint, syncSceneFromState],
  )

  const playLevelIntro = useCallback(
    async (next: GameState) => {
      busyRef.current = true
      setBusy(true)
      burstsRef.current = []

      const r = next.board.length
      const c = next.board[0]?.length ?? 0
      measureAndSetCellPx(r, c)
      setState(next)
      stateRef.current = next

      const px = cellPxRef.current
      const st = px + GAP
      const falls = buildIntroFalls(next.board, next.obstacles)
      // 障碍先就位，宝石再掉入
      sceneRef.current = boardToScene(
        Array.from({ length: r }, () => Array.from({ length: c }, () => null)),
        next.obstacles,
        null,
        px,
        st,
      )
      requestPaint()

      try {
        await animateFall(sceneRef.current, next.board, next.obstacles, falls, null, px, st, requestPaint)
        await runCascade(next)
      } finally {
        bootstrappingRef.current = false
        busyRef.current = false
        setBusy(false)
      }
    },
    [measureAndSetCellPx, requestPaint, runCascade],
  )

  const introStartedRef = useRef(false)
  const bootstrappingRef = useRef(true)

  useLayoutEffect(() => {
    const host = boardHostRef.current
    if (!host) return
    const update = () => {
      const board = stateRef.current.board
      measureAndSetCellPx(board.length, board[0]?.length ?? 0)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [measureAndSetCellPx])

  useLayoutEffect(() => {
    if (busyRef.current || bootstrappingRef.current) {
      requestPaint()
      return
    }
    syncSceneFromState(state)
  }, [state, cellPx, syncSceneFromState, requestPaint])

  useLayoutEffect(() => {
    if (introStartedRef.current) return
    introStartedRef.current = true
    void playLevelIntro(stateRef.current)
  }, [playLevelIntro])

  useLayoutEffect(() => {
    let id = 0
    let living = true
    const loop = () => {
      if (!living) return
      if (burstsRef.current.length) paint()
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => {
      living = false
      cancelAnimationFrame(id)
    }
  }, [paint])

  const trySwap = useCallback(
    async (a: Pos, b: Pos) => {
      if (busyRef.current) return
      const cur = stateRef.current
      if (cur.status !== 'playing') return
      if (!isAdjacent(a, b)) {
        setState({ ...cur, selected: b })
        return
      }

      busyRef.current = true
      setBusy(true)
      const px = cellPxRef.current
      const st = px + GAP

      if (!canSwap(cur.board, a, b, cur.obstacles)) {
        sceneRef.current = boardToScene(cur.board, cur.obstacles, null, px, st)
        await animateSwap(sceneRef.current, a, b, st, requestPaint)
        await animateSwap(sceneRef.current, b, a, st, requestPaint)
        const reset = { ...cur, selected: null }
        setState(reset)
        syncSceneFromState(reset)
        busyRef.current = false
        setBusy(false)
        return
      }

      sceneRef.current = boardToScene(cur.board, cur.obstacles, null, px, st)
      await animateSwap(sceneRef.current, a, b, st, requestPaint)

      const swapped = applySwap(cur, a, b)
      if (!swapped) {
        busyRef.current = false
        setBusy(false)
        return
      }
      setState(swapped)
      syncSceneFromState(swapped)
      await runCascade(swapped, [a, b])
      busyRef.current = false
      setBusy(false)
    },
    [requestPaint, runCascade, syncSceneFromState],
  )

  const onCanvasPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (busyRef.current) return
      const cur = stateRef.current
      if (cur.status !== 'playing') return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const board = cur.board
      const r = board.length
      const c = board[0]?.length ?? 0
      const pos = hitTest(clientX - rect.left, clientY - rect.top, r, c, cellPxRef.current, cellPxRef.current + GAP)
      if (!pos) return
      if (cur.obstacles[pos.r]?.[pos.c]) return
      if (!cur.board[pos.r]?.[pos.c]) return

      if (!cur.selected) {
        setState({ ...cur, selected: pos })
        return
      }
      if (posEq(cur.selected, pos)) {
        setState({ ...cur, selected: null })
        return
      }
      void trySwap(cur.selected, pos)
    },
    [trySwap],
  )

  const onReset = useCallback(() => {
    if (busyRef.current) return
    void playLevelIntro(restartLevel(stateRef.current))
  }, [playLevelIntro])

  const onPrevLevel = useCallback(() => {
    if (busyRef.current) return
    const idx = MATCH3_LEVELS.findIndex((l) => l.id === stateRef.current.levelId)
    const prev = MATCH3_LEVELS[Math.max(0, idx - 1)]
    if (prev && prev.id !== stateRef.current.levelId) void playLevelIntro(goToLevel(prev.id))
  }, [playLevelIntro])

  const onNextLevel = useCallback(() => {
    if (busyRef.current) return
    const idx = MATCH3_LEVELS.findIndex((l) => l.id === stateRef.current.levelId)
    const nextLv = MATCH3_LEVELS[Math.min(MATCH3_LEVELS.length - 1, idx + 1)]
    if (nextLv && nextLv.id !== stateRef.current.levelId) void playLevelIntro(goToLevel(nextLv.id))
  }, [playLevelIntro])

  const onSelectLevel = useCallback(
    (levelId: number) => {
      if (busyRef.current) return
      if (levelId === stateRef.current.levelId) return
      void playLevelIntro(goToLevel(levelId))
    },
    [playLevelIntro],
  )

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'relative flex flex-col bg-chrome text-on-chrome min-h-0'),
        'overflow-hidden h-full outline-none',
      )}
    >
      <div className={cn(winChromePanel, 'mx-2 mt-2 px-2 py-1.5 flex items-center justify-between gap-2 shrink-0')}>
        <div className='flex items-center gap-1 min-w-0'>
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-7 inline-flex items-center justify-center disabled:opacity-40')}
            disabled={levelIndex <= 0 || busy}
            onClick={onPrevLevel}
            aria-label={t('prevLevel')}
          >
            <ChevronLeft size={14} />
          </button>
          <Select
            size='md'
            className='w-[7.5rem] shrink-0'
            aria-label={t('selectLevel')}
            value={String(level.id)}
            disabled={busy}
            onValueChange={(v) => onSelectLevel(Number(v))}
            options={levelOptions}
          />
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-7 inline-flex items-center justify-center disabled:opacity-40')}
            disabled={levelIndex >= MATCH3_LEVELS.length - 1 || busy}
            onClick={onNextLevel}
            aria-label={t('nextLevel')}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          type='button'
          className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs shrink-0')}
          disabled={busy}
          onClick={onReset}
        >
          <RotateCcw size={12} aria-hidden />
          {t('reset')}
        </button>
      </div>

      <div
        className={cn(
          winChromeSunken,
          'mx-2 mt-2 px-2 py-1.5 flex items-center justify-around gap-2 shrink-0 text-center',
        )}
      >
        <Stat label={t('moves')} value={String(state.movesLeft)} warn={state.movesLeft <= 5} />
        <Stat label={t('score')} value={String(state.score)} />
        <Stat label={t('target')} value={String(level.targetScore)} accent />
      </div>

      <div ref={boardHostRef} className='flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden'>
        <div
          className={cn(winChromeSunken, 'relative shrink-0 box-border p-1.5 bg-[#6b6b6b] overflow-hidden')}
          style={{ width: boardW + FRAME_PAD, height: boardH + FRAME_PAD }}
        >
          <canvas
            ref={canvasRef}
            className='block touch-none cursor-pointer'
            role='img'
            aria-label={t('boardLabel')}
            onPointerDown={(e) => {
              e.preventDefault()
              onCanvasPointer(e.clientX, e.clientY)
            }}
          />
        </div>
      </div>

      <p className='shrink-0 px-3 pb-2 text-[10px] text-muted text-center'>{t('hint')}</p>

      {state.status === 'won' || state.status === 'lost' ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className={cn(winChrome, 'bg-chrome text-on-chrome px-5 py-4 min-w-[240px] max-w-[90%] text-center')}>
            <p
              className={cn(
                'text-lg font-bold mb-1',
                state.status === 'won' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400',
              )}
            >
              {state.status === 'won' ? t('won') : t('lost')}
            </p>
            <p className='text-xs text-muted mb-3'>{state.status === 'won' ? t('wonHint') : t('lostHint')}</p>
            <div className='flex justify-center gap-4 mb-3 text-sm tabular-nums'>
              <span>
                {t('score')}: <b>{state.score}</b>
              </span>
              <span>
                {t('target')}: <b>{level.targetScore}</b>
              </span>
            </div>
            <div className='flex flex-col items-center gap-2'>
              <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm font-semibold')} onClick={onReset}>
                {t('playAgain')}
              </button>
              {state.status === 'won' && levelIndex < MATCH3_LEVELS.length - 1 ? (
                <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onNextLevel}>
                  {t('nextLevel')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className='flex flex-col items-center gap-0.5 min-w-[64px]'>
      <span className='text-[10px] text-muted leading-none'>{label}</span>
      <div
        className={cn(
          'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          'px-2 py-0.5 font-mono text-sm tracking-wider tabular-nums leading-none',
          accent ? 'bg-[#0f2410] text-[#4dff7a]' : warn ? 'bg-[#1a1a1a] text-[#ffcc00]' : 'bg-[#1a1a1a] text-[#ff4040]',
        )}
      >
        {value}
      </div>
    </div>
  )
}
