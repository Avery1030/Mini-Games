'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome } from '@/lib/winChrome'
import { FRUITS } from './fruits'
import { SuikaEngine, type GameStatus } from './game'
import { WORLD_HEIGHT, WORLD_WIDTH } from './physics'
import { drawFruitIcon, drawSuikaFrame, type CanvasLabels } from './render'
import { playMergeSound } from './sound'

export interface SuikaProps {
  embedded?: boolean
}

type HudState = {
  score: number
  bestScore: number
  nextLevel: number
  watermelonCount: number
  status: GameStatus
}

function isEndedStatus(status: GameStatus): boolean {
  return status === 'gameover' || status === 'cleared'
}

function MiniFruit({ level, size }: { level: number; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    drawFruitIcon(ctx, level, size / 2, size / 2, size)
  }, [level, size])

  return <canvas ref={canvasRef} className='block' aria-hidden />
}

/**
 * 合成大西瓜：Canvas 渲染 + rAF 物理循环（无第三方物理库）。
 */
export function Suika({ embedded = false }: SuikaProps = {}) {
  const t = useTranslations('suika')
  const engineRef = useRef<Nullable<SuikaEngine>>(null)
  if (!engineRef.current) engineRef.current = new SuikaEngine()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pressedRef = useRef(false)
  const labelsRef = useRef<CanvasLabels>({ danger: '', hint: '' })

  const [hud, setHud] = useState<HudState>(() => {
    const s = engineRef.current!.getSnapshot()
    return {
      score: s.score,
      bestScore: s.bestScore,
      nextLevel: s.nextLevel,
      watermelonCount: s.watermelonCount,
      status: s.status,
    }
  })

  const labels = useMemo(
    () => ({
      danger: t('danger'),
      hint: t('hint'),
    }),
    [t],
  )
  labelsRef.current = labels

  const syncHud = useCallback(() => {
    const s = engineRef.current!.getSnapshot()
    setHud((prev) => {
      if (
        prev.score === s.score &&
        prev.bestScore === s.bestScore &&
        prev.nextLevel === s.nextLevel &&
        prev.watermelonCount === s.watermelonCount &&
        prev.status === s.status
      ) {
        return prev
      }
      return {
        score: s.score,
        bestScore: s.bestScore,
        nextLevel: s.nextLevel,
        watermelonCount: s.watermelonCount,
        status: s.status,
      }
    })
  }, [])

  useEffect(() => {
    const engine = engineRef.current!
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = WORLD_WIDTH * dpr
    canvas.height = WORLD_HEIGHT * dpr
    canvas.style.width = `${WORLD_WIDTH}px`
    canvas.style.height = `${WORLD_HEIGHT}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let raf = 0
    let last = performance.now()
    let hudAcc = 0
    let lastStatus = engine.status
    let lastScore = engine.score

    const loop = (now: number) => {
      const raw = (now - last) / 1000
      last = now
      const dt = Math.min(0.033, Math.max(0.001, raw))
      engine.step(dt)
      for (const merge of engine.drainMerges()) {
        playMergeSound(merge.toLevel)
      }
      drawSuikaFrame(ctx, engine, labelsRef.current)

      hudAcc += dt
      if (engine.status !== lastStatus || engine.score !== lastScore || hudAcc > 0.12) {
        lastStatus = engine.status
        lastScore = engine.score
        hudAcc = 0
        syncHud()
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
    }
  }, [syncHud])

  const clientToWorldX = useCallback((clientX: number) => {
    const el = canvasRef.current
    if (!el) return WORLD_WIDTH / 2
    const rect = el.getBoundingClientRect()
    const scale = rect.width / WORLD_WIDTH || 1
    return (clientX - rect.left) / scale
  }, [])

  const aimAt = useCallback(
    (clientX: number) => {
      engineRef.current!.setAimX(clientToWorldX(clientX))
    },
    [clientToWorldX],
  )

  const onPointerDown = (e: ReactPointerEvent) => {
    if (isEndedStatus(engineRef.current!.status)) return
    pressedRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    aimAt(e.clientX)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (isEndedStatus(engineRef.current!.status)) return
    aimAt(e.clientX)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!pressedRef.current) return
    pressedRef.current = false
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (isEndedStatus(engineRef.current!.status)) return
    aimAt(e.clientX)
    engineRef.current!.drop()
    syncHud()
  }

  const restart = useCallback(() => {
    engineRef.current!.reset()
    syncHud()
  }, [syncHud])

  useEffect(() => {
    const isTypingTarget = (target: Nullable<EventTarget>) => {
      const el = target as Nullable<HTMLElement>
      const tag = el?.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || !!el?.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const engine = engineRef.current!
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        engine.setAimX(engine.aimX - 16)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        engine.setAimX(engine.aimX + 16)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (isEndedStatus(engine.status)) restart()
        else {
          engine.drop()
          syncHud()
        }
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        restart()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [restart, syncHud])

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col bg-[#1a2e1a] text-white min-h-0'),
        'overflow-hidden',
      )}
    >
      <div className='flex items-center gap-3 px-3 py-2 border-b border-[#2d4a2d] bg-[#152515] shrink-0 text-sm'>
        <div className='flex flex-col leading-tight min-w-0'>
          <span className='text-[#a3e635] font-bold truncate'>{t('title')}</span>
          <span className='text-xs text-white/60'>
            {t('score')}: {hud.score} · {t('best')}: {hud.bestScore}
            {hud.watermelonCount > 0 ? ` · 🍉×${hud.watermelonCount}` : ''}
          </span>
        </div>
        <div className='ml-auto flex items-center gap-2 shrink-0'>
          <div className='flex items-center gap-1.5 text-xs text-white/70'>
            <span>{t('next')}</span>
            <MiniFruit level={hud.nextLevel} size={28} />
          </div>
          <button
            type='button'
            className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs text-on-chrome')}
            onClick={restart}
            aria-label={t('restart')}
          >
            <RotateCcw size={12} aria-hidden />
            {t('restart')}
          </button>
        </div>
      </div>

      <div className='flex-1 min-h-0 flex items-center justify-center p-2 overflow-auto'>
        <div
          className='relative shrink-0 border-2 border-[#3f6212] shadow-[inset_2px_2px_0_rgba(0,0,0,0.35)]'
          style={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
        >
          <canvas
            ref={canvasRef}
            className='block touch-none select-none cursor-crosshair'
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role='application'
            aria-label={t('boardLabel')}
          />

          {hud.status === 'gameover' || hud.status === 'cleared' ? (
            <div className='absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 px-4 text-center'>
              {hud.status === 'cleared' ? (
                <>
                  <p className='text-2xl mb-1' aria-hidden>
                    🍉
                  </p>
                  <p className='text-lg font-bold text-[#a3e635] mb-1'>{t('cleared')}</p>
                  <p className='text-sm text-white/80 mb-1'>{t('clearedHint')}</p>
                </>
              ) : (
                <>
                  <p className='text-lg font-bold text-red-300 mb-1'>{t('gameover')}</p>
                  <p className='text-sm text-white/70 mb-1'>{t('gameoverHint')}</p>
                </>
              )}
              <p className='text-sm text-white/80 mb-3'>
                {t('finalScore')}: {hud.score}
              </p>
              <button
                type='button'
                className={cn(winChrome, 'px-3 py-1.5 text-sm text-on-chrome')}
                onClick={(e) => {
                  e.stopPropagation()
                  restart()
                }}
              >
                {t('playAgain')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className='shrink-0 px-2 py-1.5 border-t border-[#2d4a2d] bg-[#152515] overflow-x-auto'>
        <div className='flex items-end justify-center gap-1 min-w-max mx-auto'>
          {FRUITS.map((f) => (
            <div key={f.level} title={t(`fruits.${f.nameKey}`)}>
              <MiniFruit level={f.level} size={Math.max(16, Math.min(28, f.radius * 0.55))} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
