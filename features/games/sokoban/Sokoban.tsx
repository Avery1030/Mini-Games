'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChromeSunken } from '@/lib/winChrome'
import { useSokobanProgressStore } from './store'
import { BOARD } from './boardCanvas'
import { createStateFromLevel, resetLevel, tryMove, undoMove } from './game'
import { LevelSelect } from './LevelSelect'
import { fetchAllLevels, reloadAllLevels, type LoadedLevels } from './loadLevels'
import { calcStars, type StarCount } from './stars'
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

type Screen = 'select' | 'play'

/**
 * 推箱子：先选关（顺序解锁 + 星级），再进入 Canvas 棋盘。
 */
export function Sokoban({ embedded = false, onClose }: SokobanProps = {}) {
  const t = useTranslations('sokoban')

  const boardHostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const lastMoveAtRef = useRef(0)
  const bundleRef = useRef<LoadedLevels | null>(null)
  const recordedWinKeyRef = useRef<string | null>(null)

  const [screen, setScreen] = useState<Screen>('select')
  const [catalog, setCatalog] = useState<number[]>([])
  const [levelId, setLevelId] = useState<number | null>(null)
  const [state, setState] = useState<SokobanState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cellPx, setCellPx] = useState(CELL_MIN)
  const [heldDir, setHeldDir] = useState<Direction | null>(null)
  const [winStars, setWinStars] = useState<StarCount>(1)

  const progressLevels = useSokobanProgressStore((s) => s.levels)
  const recordClear = useSokobanProgressStore((s) => s.recordClear)
  const isUnlocked = useSokobanProgressStore((s) => s.isUnlocked)
  const nextUnlockedId = useSokobanProgressStore((s) => s.nextUnlockedId)

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
  const {
    minMoves,
    minMovesReady,
    clearCache: clearMinMovesCache,
  } = useMinMoves(screen === 'play' ? (state?.levelId ?? null) : null, screen === 'play' ? state?.level : null)

  syncState(state, cellPx)

  const unlockedCatalog = useMemo(
    () => catalog.filter((id) => isUnlocked(catalog, id)),
    [catalog, isUnlocked, progressLevels],
  )

  const levelSelectItems = useMemo(
    () =>
      catalog.map((id) => {
        const prog = progressLevels[String(id)]
        return {
          id,
          unlocked: isUnlocked(catalog, id),
          stars: prog?.stars ?? 0,
          bestMoves: prog?.bestMoves ?? null,
        }
      }),
    [catalog, isUnlocked, progressLevels],
  )

  const focusGame = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      const active = document.activeElement
      if (active !== root && root.contains(active)) active.blur()
    }
    root.focus({ preventScroll: true })
  }, [])

  const backToSelect = useCallback(() => {
    stopCrackDemo()
    stopAnim()
    setScreen('select')
    setHeldDir(null)
    recordedWinKeyRef.current = null
  }, [stopAnim, stopCrackDemo])

  const selectLevel = useCallback(
    (id: number) => {
      const bundle = bundleRef.current
      if (!bundle) return
      if (!isUnlocked(bundle.ids, id)) return
      const level = bundle.byId.get(id)
      if (!level) {
        setLoadError('loadFailed')
        return
      }
      stopCrackDemo()
      recordedWinKeyRef.current = null
      setLevelId(id)
      setState(createStateFromLevel(id, level))
      setLoadError(null)
      setScreen('play')
      requestAnimationFrame(() => focusGame())
    },
    [focusGame, isUnlocked, stopCrackDemo],
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

  // 通关记星：先按当前最短（可能尚未算出）记一笔以解锁下一关；最短就绪后再刷新星级
  useEffect(() => {
    if (screen !== 'play' || !state?.won || levelId == null) return
    const key = `${levelId}:${state.moves}:${minMovesReady ? String(minMoves) : 'pending'}`
    if (recordedWinKeyRef.current === key) return
    recordedWinKeyRef.current = key
    const stars = recordClear(levelId, state.moves, minMovesReady ? minMoves : null)
    setWinStars(stars)
  }, [screen, state?.won, state?.moves, levelId, minMoves, minMovesReady, recordClear])

  useLayoutEffect(() => {
    if (loading || screen !== 'play') return
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
  }, [loading, screen, state?.levelId, state?.level.width, state?.level.height, stateRef])

  useEffect(() => {
    if (screen !== 'play' || !state) return
    onStateChanged(state)
  }, [screen, state, onStateChanged])

  useEffect(() => {
    if (screen !== 'play') return
    repaintForCellPx(cellPx)
  }, [screen, cellPx, repaintForCellPx])

  useEffect(() => () => stopAnim(), [stopAnim])

  const applyMove = useCallback(
    (dir: Direction) => {
      if (screen !== 'play') return
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
    [crackDemoRef, focusGame, screen, stateRef],
  )

  useEffect(() => {
    if (screen !== 'play') return
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
  }, [applyMove, crackDemoRef, focusGame, screen])

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
      if (unlockedCatalog.length === 0 || levelId == null) return
      const idx = unlockedCatalog.indexOf(levelId)
      if (idx < 0) return
      const next = unlockedCatalog[idx + delta]
      if (next != null) selectLevel(next)
    },
    [levelId, selectLevel, unlockedCatalog],
  )

  const onUndo = useCallback(() => {
    if (crackDemoRef.current) return
    setState((prev) => (prev ? undoMove(prev) : prev))
  }, [crackDemoRef])

  const onReset = useCallback(() => {
    stopCrackDemo()
    recordedWinKeyRef.current = null
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
      if (screen === 'play' && levelId != null && bundle.byId.has(levelId) && isUnlocked(bundle.ids, levelId)) {
        setState(createStateFromLevel(levelId, bundle.byId.get(levelId)!))
        recordedWinKeyRef.current = null
        requestAnimationFrame(() => focusGame())
      } else if (screen === 'play') {
        setScreen('select')
        setLevelId(null)
        setState(null)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'loadFailed')
      setState(null)
    } finally {
      setLoading(false)
    }
  }, [clearMinMovesCache, focusGame, isUnlocked, levelId, loading, screen, stopCrackDemo])

  const statusHint =
    crackError === 'unsolvable'
      ? t('crackFailed')
      : crackProgress
        ? t('crackProgress', { step: crackProgress.step, total: crackProgress.total })
        : t('hint')

  const canPrev = levelId != null && unlockedCatalog.indexOf(levelId) > 0
  const canNext =
    levelId != null &&
    unlockedCatalog.indexOf(levelId) >= 0 &&
    unlockedCatalog.indexOf(levelId) < unlockedCatalog.length - 1

  const nextInCatalog =
    levelId != null && catalog.indexOf(levelId) >= 0 ? (catalog[catalog.indexOf(levelId) + 1] ?? null) : null
  const canGoNextAfterWin = Boolean(state?.won && nextInCatalog != null)

  if (screen === 'select') {
    return (
      <div
        className={cn(embeddedAppShell(embedded, 'relative flex flex-col bg-chrome text-on-chrome min-h-0'), 'h-full')}
      >
        <LevelSelect
          items={levelSelectItems}
          loading={loading}
          loadError={loadError}
          labels={{
            title: t('selectTitle'),
            hint: t('selectHint'),
            levelN: (n) => t('levelN', { n }),
            locked: t('locked'),
            cleared: t('cleared'),
            loading: t('loading'),
            loadFailed: t('loadFailed'),
            bestMoves: t('bestMoves'),
          }}
          onPick={selectLevel}
        />
      </div>
    )
  }

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
          levelSelect: t('levelSelect'),
        }}
        state={state}
        minMoves={minMoves}
        minMovesReady={minMovesReady}
        unlockedCatalog={unlockedCatalog}
        levelId={levelId}
        loading={loading}
        crackEnabled={crackEnabled}
        crackPhase={crackPhase}
        canPrev={canPrev}
        canNext={canNext}
        onClose={onClose}
        onUndo={onUndo}
        onReset={onReset}
        onCrackStart={startCrackDemo}
        onCrackPause={pauseCrackDemo}
        onCrackResume={resumeCrackDemo}
        onSelectLevel={onSelectLevel}
        onAdjacentLevel={goAdjacentLevel}
        onReloadLevels={() => void onReloadLevels()}
        onLevelSelect={backToSelect}
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
          stars={minMovesReady ? winStars : calcStars(state.moves, minMoves)}
          hasNextLevel={canGoNextAfterWin || nextUnlockedId(catalog, levelId!) != null}
          labels={{
            won: t('won'),
            wonHint: t('wonHint'),
            moves: t('moves'),
            best: t('best'),
            stars: t('stars'),
            playAgain: t('playAgain'),
            nextLevel: t('nextLevel'),
            levelSelect: t('levelSelect'),
            close: t('close'),
          }}
          onReset={onReset}
          onNextLevel={() => {
            if (state && levelId != null) {
              recordClear(levelId, state.moves, minMovesReady ? minMoves : null)
            }
            if (nextInCatalog != null) selectLevel(nextInCatalog)
          }}
          onLevelSelect={backToSelect}
          onClose={onClose}
        />
      ) : null}
    </div>
  )
}
