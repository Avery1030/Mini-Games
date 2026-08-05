'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChromeSunken } from '@/lib/winChrome'
import { BOARD } from './boardCanvas'
import { createStateFromLevel, resetLevel, tryMove, undoMove } from './game'
import { fetchAllLevels, reloadAllLevels, type LoadedLevels } from './loadLevels'
import { Toolbar } from './Toolbar'
import { CELL_MAX, CELL_MIN, Dpad, keyToDir, MOVE_COOLDOWN_MS } from './uiParts'
import { useBoardAnim } from './useBoardAnim'
import { useCrackDemo } from './useCrackDemo'
import { useMinMoves } from './useMinMoves'
import { WinDialog } from './WinDialog'
import type { Direction, SokobanState } from './types'

export interface SokobanProps {
  embedded?: boolean
  onClose?: () => void
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
  const bundleRef = useRef<LoadedLevels | null>(null)

  const [catalog, setCatalog] = useState<number[]>([])
  const [levelId, setLevelId] = useState<number | null>(null)
  const [state, setState] = useState<SokobanState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cellPx, setCellPx] = useState(CELL_MIN)
  const [heldDir, setHeldDir] = useState<Direction | null>(null)

  const { stateRef, syncState, onStateChanged, repaintForCellPx, stopAnim } = useBoardAnim(canvasRef)
  const {
    enabled: crackEnabled,
    crackPhase,
    crackProgress,
    crackError,
    crackDemoRef,
    startCrackDemo,
    pauseCrackDemo,
    resumeCrackDemo,
    stopCrackDemo,
  } = useCrackDemo({ stateRef, setState, setHeldDir })
  const { minMoves, minMovesReady, clearCache: clearMinMovesCache } = useMinMoves(
    state?.levelId ?? null,
    state?.level,
  )

  syncState(state, cellPx)

  const focusGame = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      const active = document.activeElement
      if (active !== root && root.contains(active)) active.blur()
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
      stopCrackDemo()
      setLevelId(id)
      setState(createStateFromLevel(id, level))
      setLoadError(null)
      requestAnimationFrame(() => focusGame())
    },
    [focusGame, stopCrackDemo],
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

  useLayoutEffect(() => {
    if (loading) return
    const host = boardHostRef.current
    if (!host || !stateRef.current) return

    const update = () => {
      const level = stateRef.current?.level
      if (!level) return
      const pad = 20
      const availW = Math.max(0, host.clientWidth - pad)
      const availH = Math.max(0, host.clientHeight - pad)
      const byW = Math.floor(availW / level.width)
      const byH = Math.floor(availH / level.height)
      const next = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.min(byW, byH) || CELL_MIN))
      setCellPx((prev) => (prev === next ? prev : next))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [loading, state?.levelId, state?.level.width, state?.level.height, stateRef])

  useEffect(() => {
    if (!state) return
    onStateChanged(state)
  }, [state, onStateChanged])

  useEffect(() => {
    repaintForCellPx(cellPx)
  }, [cellPx, repaintForCellPx])

  useEffect(() => () => stopAnim(), [stopAnim])

  const applyMove = useCallback(
    (dir: Direction) => {
      if (crackDemoRef.current) return
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
    [crackDemoRef, focusGame, stateRef],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (crackDemoRef.current) {
        if (keyToDir(e.key) || (e.key === 'z' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          e.stopPropagation()
        }
        return
      }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setState((prev) => (prev ? undoMove(prev) : prev))
        return
      }
      const dir = keyToDir(e.key)
      if (!dir) return

      const ae = document.activeElement
      if (ae instanceof HTMLElement && ae.getAttribute('aria-expanded') === 'true') return

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
  }, [applyMove, crackDemoRef, focusGame])

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
    if (crackDemoRef.current) return
    setState((prev) => (prev ? undoMove(prev) : prev))
  }, [crackDemoRef])

  const onReset = useCallback(() => {
    stopCrackDemo()
    setState((prev) => (prev ? resetLevel(prev) : prev))
  }, [stopCrackDemo])

  const onReloadLevels = useCallback(async () => {
    if (loading) return
    stopCrackDemo()
    clearMinMovesCache()
    setLoading(true)
    setLoadError(null)
    try {
      const bundle = await reloadAllLevels()
      bundleRef.current = bundle
      setCatalog(bundle.ids)
      const prefer = levelId != null && bundle.byId.has(levelId) ? levelId : bundle.ids[0]
      if (prefer == null) {
        setLevelId(null)
        setState(null)
        return
      }
      setLevelId(prefer)
      setState(createStateFromLevel(prefer, bundle.byId.get(prefer)!))
      requestAnimationFrame(() => focusGame())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'loadFailed')
      setState(null)
    } finally {
      setLoading(false)
    }
  }, [clearMinMovesCache, focusGame, levelId, loading, stopCrackDemo])

  const statusHint =
    crackError === 'unsolvable'
      ? t('crackFailed')
      : crackProgress
        ? t('crackProgress', { step: crackProgress.step, total: crackProgress.total })
        : t('hint')

  return (
    <div
      ref={rootRef}
      className={cn(
        embeddedAppShell(embedded, 'relative flex flex-col bg-chrome text-on-chrome min-h-0'),
        'overflow-hidden h-full outline-none',
      )}
      tabIndex={0}
    >
      <Toolbar
        labels={{
          moves: t('moves'),
          best: t('best'),
          undo: t('undo'),
          reset: t('reset'),
          crack: t('crack'),
          crackPause: t('crackPause'),
          crackResume: t('crackResume'),
          close: t('close'),
          level: t('level'),
          levelN: (n) => t('levelN', { n }),
          prevLevel: t('prevLevel'),
          nextLevel: t('nextLevel'),
          reloadLevel: t('reloadLevel'),
        }}
        state={state}
        minMoves={minMoves}
        minMovesReady={minMovesReady}
        catalog={catalog}
        levelId={levelId}
        loading={loading}
        crackEnabled={crackEnabled}
        crackPhase={crackPhase}
        onClose={onClose}
        onUndo={onUndo}
        onReset={onReset}
        onCrackStart={startCrackDemo}
        onCrackPause={pauseCrackDemo}
        onCrackResume={resumeCrackDemo}
        onSelectLevel={onSelectLevel}
        onAdjacentLevel={goAdjacentLevel}
        onReloadLevels={() => void onReloadLevels()}
      />

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
            <canvas ref={canvasRef} className='block' aria-label={t('player')} />
          </div>
        ) : null}
      </div>

      <Dpad
        heldDir={heldDir}
        disabled={crackPhase !== 'idle'}
        labels={{
          up: t('dirUp'),
          down: t('dirDown'),
          left: t('dirLeft'),
          right: t('dirRight'),
        }}
        onMove={applyMove}
      />

      <p className='shrink-0 px-3 pb-1.5 text-[10px] text-muted text-center truncate'>{statusHint}</p>

      {state?.won ? (
        <WinDialog
          state={state}
          minMoves={minMoves}
          minMovesReady={minMovesReady}
          hasNextLevel={catalog.length > 1}
          labels={{
            won: t('won'),
            wonHint: t('wonHint'),
            moves: t('moves'),
            best: t('best'),
            playAgain: t('playAgain'),
            nextLevel: t('nextLevel'),
            close: t('close'),
          }}
          onReset={onReset}
          onNextLevel={() => goAdjacentLevel(1)}
          onClose={onClose}
        />
      ) : null}
    </div>
  )
}
