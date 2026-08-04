'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { Select } from '@/components/ui'
import { boxOnTarget, createStateFromLevel, resetLevel, tryMove, undoMove } from './game'
import { fetchAllLevels, type LoadedLevels } from './loadLevels'
import { targetSet, wallSet, voidSet } from './parseLevel'
import type { Direction, LevelJsonEntry, SokobanState } from './types'

export interface SokobanProps {
  embedded?: boolean
  onClose?: () => void
}

const MOVE_COOLDOWN_MS = 110
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

/** 俯视小人：头 + 肩身 + 手臂，随格子缩放 */
function PlayerSprite({
  size,
  label,
  x,
  y,
}: {
  size: number
  label: string
  x: number
  y: number
}) {
  const uid = useId().replace(/:/g, '')
  const head = `${uid}-head`
  const body = `${uid}-body`
  const arm = `${uid}-arm`
  const cap = `${uid}-cap`
  const pad = Math.max(1, Math.round(size * 0.06))

  return (
    <div
      className='absolute transition-[left,top] duration-100 ease-out pointer-events-none'
      style={{ left: x, top: y, width: size, height: size, zIndex: 3 }}
      aria-label={label}
    >
      <svg
        width={size - pad * 2}
        height={size - pad * 2}
        viewBox='0 0 64 64'
        className='absolute'
        style={{ left: pad, top: pad, filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}
        aria-hidden
      >
        <defs>
          <radialGradient id={head} cx='35%' cy='30%' r='65%'>
            <stop offset='0%' stopColor='#ffe0bd' />
            <stop offset='55%' stopColor='#f0b888' />
            <stop offset='100%' stopColor='#d4926a' />
          </radialGradient>
          <linearGradient id={body} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#6ea0ff' />
            <stop offset='45%' stopColor='#3b6fe0' />
            <stop offset='100%' stopColor='#1e3fa8' />
          </linearGradient>
          <linearGradient id={arm} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#5b8ef5' />
            <stop offset='100%' stopColor='#2a4fb8' />
          </linearGradient>
          <linearGradient id={cap} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#3d5cff' />
            <stop offset='100%' stopColor='#1a2f9e' />
          </linearGradient>
        </defs>

        <ellipse cx='14' cy='36' rx='8' ry='11' fill={`url(#${arm})`} stroke='#153080' strokeWidth='1.2' />
        <circle cx='12' cy='46' r='4.2' fill={`url(#${head})`} stroke='#c47a52' strokeWidth='0.8' />

        <ellipse cx='50' cy='36' rx='8' ry='11' fill={`url(#${arm})`} stroke='#153080' strokeWidth='1.2' />
        <circle cx='52' cy='46' r='4.2' fill={`url(#${head})`} stroke='#c47a52' strokeWidth='0.8' />

        <ellipse cx='32' cy='38' rx='15' ry='17' fill={`url(#${body})`} stroke='#153080' strokeWidth='1.5' />
        <ellipse cx='32' cy='30' rx='9' ry='4' fill='rgba(255,255,255,0.22)' />

        <circle cx='32' cy='18' r='12' fill={`url(#${head})`} stroke='#c47a52' strokeWidth='1.2' />
        <path
          d='M20 16 Q32 8 44 16 Q32 12 20 16'
          fill={`url(#${cap})`}
          stroke='#152878'
          strokeWidth='0.8'
        />
        <ellipse cx='32' cy='14' rx='10' ry='5.5' fill={`url(#${cap})`} stroke='#152878' strokeWidth='0.8' />

        <circle cx='28' cy='19' r='1.8' fill='#1a1a2e' />
        <circle cx='36' cy='19' r='1.8' fill='#1a1a2e' />
        <circle cx='27.5' cy='18.4' r='0.6' fill='#fff' />
        <circle cx='35.5' cy='18.4' r='0.6' fill='#fff' />

        <path d='M28 23 Q32 26 36 23' fill='none' stroke='#b06040' strokeWidth='1.2' strokeLinecap='round' />
      </svg>
    </div>
  )
}

/**
 * 推箱子：纯 DOM 格子地图 + 键盘/屏幕方向键，关卡见 levels.ts。
 */
export function Sokoban({ embedded = false, onClose }: SokobanProps = {}) {
  const t = useTranslations('sokoban')

  const boardHostRef = useRef<HTMLDivElement>(null)
  const lastMoveAtRef = useRef(0)
  const stateRef = useRef<SokobanState | null>(null)
  const bundleRef = useRef<LoadedLevels | null>(null)

  const [catalog, setCatalog] = useState<LevelJsonEntry[]>([])
  const [levelId, setLevelId] = useState<number | null>(null)
  const [state, setState] = useState<SokobanState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [cellPx, setCellPx] = useState(32)
  const [heldDir, setHeldDir] = useState<Direction | null>(null)

  stateRef.current = state

  const selectLevel = useCallback((id: number) => {
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
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const bundle = await fetchAllLevels()
        if (cancelled) return
        bundleRef.current = bundle
        setCatalog(bundle.entries)
        const first = bundle.entries[0]
        if (first) {
          setLevelId(first.id)
          setState(createStateFromLevel(first.id, bundle.byId.get(first.id)!))
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

  const applyMove = useCallback((dir: Direction) => {
    const now = Date.now()
    if (now - lastMoveAtRef.current < MOVE_COOLDOWN_MS) return
    const cur = stateRef.current
    if (!cur || cur.won) return
    const next = tryMove(cur, dir)
    if (next === cur) return
    lastMoveAtRef.current = now
    setState(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setState((prev) => (prev ? undoMove(prev) : prev))
        return
      }
      const dir = keyToDir(e.key)
      if (!dir) return
      e.preventDefault()
      setHeldDir(dir)
      applyMove(dir)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key)
      if (dir) setHeldDir((prev) => (prev === dir ? null : prev))
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [applyMove])

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
      const idx = catalog.findIndex((c) => c.id === levelId)
      if (idx < 0) return
      const next = catalog[(idx + delta + catalog.length) % catalog.length]
      if (next) selectLevel(next.id)
    },
    [catalog, levelId, selectLevel],
  )

  const onUndo = useCallback(() => {
    setState((prev) => (prev ? undoMove(prev) : prev))
  }, [])

  const onReset = useCallback(() => {
    setState((prev) => (prev ? resetLevel(prev) : prev))
  }, [])

  const walls = useMemo(() => (state ? wallSet(state.level.walls) : new Set<string>()), [state])
  const voids = useMemo(() => (state ? voidSet(state.level.voids) : new Set<string>()), [state])
  const targets = useMemo(() => (state ? targetSet(state.level.targets) : new Set<string>()), [state])

  const placedCount = useMemo(() => {
    if (!state) return 0
    return state.boxes.filter((b) => boxOnTarget(b, state.level.targets)).length
  }, [state])

  const selectOptions = catalog.map((c) => ({
    value: String(c.id),
    label: t('levelN', { n: c.id }),
  }))

  const gap = Math.max(1, Math.round(cellPx * 0.04))

  return (
    <div
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

      {/* 棋盘 */}
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
              background:
                'repeating-conic-gradient(color-mix(in srgb, var(--chrome-face-active) 88%, #000) 0% 25%, color-mix(in srgb, var(--chrome-face) 70%, #000) 0% 50%) 0 0 / 10px 10px',
            }}
            role='application'
            aria-label={t('boardLabel')}
          >
            <div
              className='relative bg-[#8b7355] dark:bg-[#5c4a38]'
              style={{ width: state.level.width * cellPx, height: state.level.height * cellPx }}
            >
              {Array.from({ length: state.level.height }, (_, y) =>
                Array.from({ length: state.level.width }, (_, x) => {
                  const key = `${x},${y}`
                  if (voids.has(key)) return null
                  const isW = walls.has(key)
                  const isT = targets.has(key)
                  return (
                    <div
                      key={key}
                      className='absolute box-border'
                      style={{
                        left: x * cellPx,
                        top: y * cellPx,
                        width: cellPx,
                        height: cellPx,
                      }}
                    >
                      {isW ? (
                        <div
                          className='absolute inset-0'
                          style={{
                            background: 'linear-gradient(135deg, #8a8a8a 0%, #5a5a5a 45%, #3f3f3f 100%)',
                            boxShadow: 'inset 1px 1px 0 #b0b0b0, inset -1px -1px 0 #2a2a2a, 0 0 0 1px #2a2a2a',
                          }}
                        >
                          <div
                            className='absolute inset-[18%] rounded-[1px] opacity-35'
                            style={{
                              background:
                                'repeating-linear-gradient(90deg, transparent 0 45%, #1a1a1a 45% 50%, transparent 50% 95%, #1a1a1a 95% 100%)',
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          className='absolute inset-0'
                          style={{
                            background: isT
                              ? 'linear-gradient(180deg, #d4c49a 0%, #bba87a 100%)'
                              : 'linear-gradient(180deg, #cfc07a 0%, #b8a85e 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                          }}
                        >
                          {isT ? (
                            <div className='absolute inset-0 flex items-center justify-center'>
                              <div
                                className='rounded-full border-2 border-[#8b4513]/80'
                                style={{
                                  width: Math.max(8, cellPx * 0.38),
                                  height: Math.max(8, cellPx * 0.38),
                                  boxShadow: 'inset 0 0 0 2px rgba(139,69,19,0.35)',
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )
                }),
              )}

              {state.boxes.map((b, i) => {
                const onGoal = boxOnTarget(b, state.level.targets)
                return (
                  <div
                    key={`box-${i}`}
                    className='absolute box-border transition-[left,top] duration-100 ease-out'
                    style={{
                      left: b.x * cellPx + gap,
                      top: b.y * cellPx + gap,
                      width: cellPx - gap * 2,
                      height: cellPx - gap * 2,
                      zIndex: 2,
                      borderRadius: 2,
                      background: onGoal
                        ? 'linear-gradient(145deg, #f0a050 0%, #d2691e 55%, #a04812 100%)'
                        : 'linear-gradient(145deg, #e0a868 0%, #c68642 55%, #8b5a2b 100%)',
                      boxShadow: onGoal
                        ? 'inset 1px 1px 0 rgba(255,255,255,0.55), inset -1px -1px 0 rgba(0,0,0,0.35), 0 0 0 2px #6b3a10'
                        : 'inset 1px 1px 0 rgba(255,255,255,0.45), inset -1px -1px 0 rgba(0,0,0,0.35)',
                    }}
                    aria-hidden
                  >
                    <div
                      className='absolute inset-[22%] border border-black/25'
                      style={{
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
                      }}
                    />
                  </div>
                )
              })}

              <PlayerSprite
                size={cellPx}
                x={state.player.x * cellPx}
                y={state.player.y * cellPx}
                label={t('player')}
              />
            </div>
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
