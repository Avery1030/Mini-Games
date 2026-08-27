'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Select, closeModal, confirmModal, openModal, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChromeSunken } from '@/lib/winChrome'
import { useSpiderStore } from '@/features/games/spider/store'
import {
  COLLECT_CARD_MS,
  COLLECT_RUN_GAP,
  COLLECT_STAGGER,
  DEAL_CARD_MS,
  DEAL_STAGGER,
  DRAG_PX,
  FLIP_MS,
  SNAP_MS,
  UNDO_CARD_MS,
  buildUndoFlights,
  createFlightBatch,
  flippedIdAfter,
  formatTime,
  easeOut,
  isUndoDeal,
  newlyFlippedId,
  sampleFlights,
  type Flight,
  type FlightBatch,
} from './anim'
import {
  canDeal,
  cloneState,
  collectCompleted,
  placeDeal,
  placeMove,
  scoreWithTimeBonus,
  type CollectedRun,
} from './game'
import {
  cardRect,
  computeLayout,
  drawSpider,
  dropColumnAt,
  foundationRect,
  hitTestCard,
  hitTestColumn,
  hitTestStock,
  onSpiderLogoReady,
  pickupFromHit,
  preloadSpiderLogo,
  setupHiDpiCanvas,
  stockTopRect,
  type Layout,
} from './render'
import { playShuffleSound } from './sound'
import { COLS, DEAL_SIZE, DIFFICULTIES, type Card, type Difficulty, type SpiderState } from './types'

export type SpiderProps = {
  embedded?: boolean
}

const WIN_MODAL_ID = 'spider-win'
const LOSE_MODAL_ID = 'spider-lose'

type DragPack = {
  col: number
  index: number
  cards: Card[]
  grabX: number
  grabY: number
  originX: number
  originY: number
}

type PendingPointer = {
  startX: number
  startY: number
  col: number | null
  pack: DragPack | null
}

type Selection = { col: number; index: number }

export function Spider({ embedded = false }: SpiderProps) {
  const t = useTranslations('spider')
  const [hydrated, setHydrated] = useState(() => useSpiderStore.persist.hasHydrated())
  const difficulty = useSpiderStore((s) => s.difficulty)
  const state = useSpiderStore((s) => s.state)
  const undoStack = useSpiderStore((s) => s.undoStack)
  const elapsed = useSpiderStore((s) => s.elapsed)
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [busy, setBusy] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<Layout | null>(null)
  const stateRef = useRef<SpiderState | null>(state)
  const selectedRef = useRef<Selection | null>(null)
  const pendingRef = useRef<PendingPointer | null>(null)
  const dragRef = useRef<DragPack | null>(null)
  const ghostRef = useRef<{ x: number; y: number } | null>(null)
  const animRef = useRef<{
    cards: Card[]
    x0: number
    y0: number
    x1: number
    y1: number
    start: number
    onDone: () => void
  } | null>(null)
  const batchRef = useRef<FlightBatch | null>(null)
  const flipRef = useRef<{ id: number; start: number } | null>(null)
  const rafRef = useRef(0)
  const winShownRef = useRef(false)
  const genRef = useRef(0)

  stateRef.current = state
  selectedRef.current = selected

  useEffect(() => {
    const finish = () => {
      useSpiderStore.getState().ensureGame()
      setHydrated(true)
      const session = useSpiderStore.getState()
      const s = session.state
      if (s && !s.won && !s.lost && (s.moves > 0 || session.elapsed > 0)) {
        setRunning(true)
      }
    }
    if (useSpiderStore.persist.hasHydrated()) {
      finish()
      return
    }
    return useSpiderStore.persist.onFinishHydration(finish)
  }, [])

  const animating = () => Boolean(animRef.current || flipRef.current || dragRef.current || batchRef.current)

  const pushUndo = useCallback((prev: SpiderState) => {
    useSpiderStore.getState().pushUndo(prev)
  }, [])

  const setGameState = useCallback((next: SpiderState) => {
    stateRef.current = next
    useSpiderStore.getState().setGameState(next)
  }, [])

  const clearTransient = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    dragRef.current = null
    pendingRef.current = null
    animRef.current = null
    batchRef.current = null
    flipRef.current = null
    ghostRef.current = null
  }, [])

  const restart = useCallback(
    (nextDiff = difficulty) => {
      genRef.current += 1
      clearTransient()
      winShownRef.current = false
      closeModal(WIN_MODAL_ID)
      closeModal(LOSE_MODAL_ID)
      useSpiderStore.getState().restart(nextDiff)
      setRunning(false)
      setSelected(null)
      setBusy(false)
    },
    [clearTransient, difficulty],
  )

  const confirmRestart = useCallback(async () => {
    const ok = await confirmModal({
      title: t('newGameConfirmTitle'),
      message: t('newGameConfirm'),
    })
    if (ok) restart()
  }, [restart, t])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const cur = stateRef.current
    if (!canvas || !wrap || !cur) return
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w < 8 || h < 8) return
    const ctx = setupHiDpiCanvas(canvas, w, h)
    if (!ctx) return
    const layout = computeLayout(w, h)
    layoutRef.current = layout

    const hidden = new Set<number>()
    let ghost: { cards: Card[]; x: number; y: number } | undefined
    const drag = dragRef.current
    if (drag && ghostRef.current) {
      for (const c of drag.cards) hidden.add(c.id)
      ghost = { cards: drag.cards, x: ghostRef.current.x, y: ghostRef.current.y }
    }

    const anim = animRef.current
    if (anim) {
      const p = easeOut((performance.now() - anim.start) / SNAP_MS)
      for (const c of anim.cards) hidden.add(c.id)
      ghost = {
        cards: anim.cards,
        x: anim.x0 + (anim.x1 - anim.x0) * p,
        y: anim.y0 + (anim.y1 - anim.y0) * p,
      }
    }

    const batch = batchRef.current
    const flights = batch ? sampleFlights(batch, performance.now(), DEAL_CARD_MS) : []
    if (batch) {
      for (const f of batch.flights) hidden.add(f.card.id)
    }

    let flip: { id: number; scaleX: number; showFace: boolean } | undefined
    if (flipRef.current) {
      const p = Math.min(1, (performance.now() - flipRef.current.start) / FLIP_MS)
      const scaleX = p < 0.5 ? 1 - p * 2 : p * 2 - 1
      flip = { id: flipRef.current.id, scaleX: Math.max(0.04, scaleX), showFace: p >= 0.5 }
    }

    const active = selectedRef.current

    drawSpider(ctx, cur, layout, {
      hiddenIds: hidden,
      ghost,
      flights: flights.length ? flights : undefined,
      active,
      flip,
      stockPending: batch?.stockPending ?? 0,
    })
  }, [])

  const paintRef = useRef(paint)
  paintRef.current = paint

  const kickLoop = useCallback(() => {
    if (rafRef.current) return
    const loop = () => {
      const now = performance.now()
      const anim = animRef.current
      const flip = flipRef.current
      const batch = batchRef.current
      if (anim && now - anim.start >= SNAP_MS) {
        const done = anim.onDone
        animRef.current = null
        done()
      }
      if (flip && now - flip.start >= FLIP_MS) flipRef.current = null
      if (batch && now - batch.start >= batch.total) {
        const done = batch.onDone
        batchRef.current = null
        done()
      }
      paintRef.current()
      if (animating()) rafRef.current = window.requestAnimationFrame(loop)
      else rafRef.current = 0
    }
    rafRef.current = window.requestAnimationFrame(loop)
  }, [])

  const startBatch = useCallback(
    (
      flights: Flight[],
      onDone: () => void,
      opts?: { stockPending?: number; total?: number; fallbackDuration?: number },
    ) => {
      const gen = genRef.current
      setBusy(true)
      batchRef.current = createFlightBatch(
        flights,
        () => {
          setBusy(false)
          if (genRef.current !== gen) return
          onDone()
        },
        opts,
      )
      kickLoop()
    },
    [kickLoop],
  )

  const hasBoard = state != null
  const terminal = Boolean(state?.won || state?.lost)

  useEffect(() => {
    if (!hydrated || !hasBoard) return
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(wrap)
    paint()
    return () => ro.disconnect()
  }, [paint, hydrated, hasBoard])

  useEffect(() => {
    preloadSpiderLogo()
    return onSpiderLogoReady(() => paintRef.current())
  }, [])

  useEffect(() => {
    if (!hydrated || !hasBoard) return
    paint()
  }, [paint, state, selected, hydrated, hasBoard])

  useEffect(() => {
    if (!running || !hasBoard || terminal) return
    const id = window.setInterval(() => useSpiderStore.getState().setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [running, hasBoard, terminal])

  useEffect(() => {
    if (!state) return
    if (winShownRef.current) return
    if (state.won) {
      winShownRef.current = true
      const score = scoreWithTimeBonus(state, elapsed)
      openModal({
        id: WIN_MODAL_ID,
        title: t('wonTitle'),
        content: t('wonHint', { time: formatTime(elapsed), moves: state.moves, score }),
        dismissible: true,
        showClose: true,
        actions: [{ id: 'again', label: t('playAgain'), primary: true }],
        onClose: ({ actionId }) => {
          if (actionId === 'again') restart()
        },
      })
      return
    }
    if (!state.lost) return
    winShownRef.current = true
    openModal({
      id: LOSE_MODAL_ID,
      title: t('lostTitle'),
      content: t('lostHint', { time: formatTime(elapsed), moves: state.moves, score: state.score }),
      dismissible: true,
      showClose: true,
      actions: [{ id: 'again', label: t('playAgain'), primary: true }],
      onClose: ({ actionId }) => {
        if (actionId === 'again') restart()
      },
    })
  }, [state, elapsed, t, restart])

  useEffect(() => {
    return () => {
      clearTransient()
    }
  }, [clearTransient])

  const commit = useCallback(
    (next: SpiderState, prev: SpiderState, flippedId?: number) => {
      pushUndo(prev)
      setGameState(next)
      setRunning(true)
      setSelected(null)
      if (next.won || next.lost) setRunning(false)
      if (flippedId != null) {
        flipRef.current = { id: flippedId, start: performance.now() }
        kickLoop()
      }
    },
    [kickLoop, pushUndo, setGameState],
  )

  const playCollect = useCallback(
    (placed: SpiderState, runs: CollectedRun[], onDone: () => void) => {
      const layout = layoutRef.current
      if (!layout || runs.length === 0) {
        onDone()
        return
      }
      const mini = foundationRect(layout, 0).w / layout.cardW
      const flights: Flight[] = []
      runs.forEach((run, ri) => {
        const pile = placed.tableau[run.col] ?? []
        const dest = foundationRect(layout, placed.completed.length + ri)
        run.cards.forEach((card, i) => {
          const idx = pile.findIndex((c) => c.id === card.id)
          const r = idx >= 0 ? cardRect(pile, run.col, idx, layout) : { x: dest.x, y: dest.y }
          flights.push({
            card,
            x0: r.x,
            y0: r.y,
            x1: dest.x,
            y1: dest.y,
            delay: ri * COLLECT_RUN_GAP + i * COLLECT_STAGGER,
            scale0: 1,
            scale1: mini,
            faceUp: true,
            duration: COLLECT_CARD_MS,
          })
        })
      })
      playShuffleSound()
      startBatch(flights, onDone, { fallbackDuration: COLLECT_CARD_MS })
    },
    [startBatch],
  )

  const finishAction = useCallback(
    (placed: SpiderState, prev: SpiderState, flippedId?: number) => {
      const { state: next, runs } = collectCompleted(placed)
      if (runs.length === 0) {
        commit(next, prev, flippedId)
        return
      }
      setGameState(placed)
      setRunning(true)
      setSelected(null)
      if (flippedId != null) {
        flipRef.current = { id: flippedId, start: performance.now() }
        kickLoop()
      }
      playCollect(placed, runs, () => {
        commit(next, prev, newlyFlippedId(placed, next))
      })
    },
    [commit, kickLoop, playCollect, setGameState],
  )

  const snapTo = useCallback(
    (cards: Card[], from: { x: number; y: number }, to: { x: number; y: number }, onDone: () => void) => {
      const gen = genRef.current
      animRef.current = {
        cards,
        x0: from.x,
        y0: from.y,
        x1: to.x,
        y1: to.y,
        start: performance.now(),
        onDone: () => {
          if (genRef.current !== gen) return
          onDone()
        },
      }
      dragRef.current = null
      ghostRef.current = null
      kickLoop()
    },
    [kickLoop],
  )

  const tryMoveTo = useCallback(
    (fromCol: number, fromIndex: number, toCol: number, fromPos: { x: number; y: number }) => {
      const cur = stateRef.current
      const layout = layoutRef.current
      if (!cur || !layout) return false
      const placed = placeMove(cur, fromCol, fromIndex, toCol)
      if (!placed) return false
      const pack = cur.tableau[fromCol]?.slice(fromIndex) ?? []
      const destPile = cur.tableau[toCol] ?? []
      snapTo(
        pack,
        fromPos,
        { x: layout.colX[toCol] ?? 0, y: cardRect(destPile, toCol, destPile.length, layout).y },
        () => finishAction(placed, cur, flippedIdAfter(cur, fromCol, fromIndex)),
      )
      return true
    },
    [finishAction, snapTo],
  )

  const tryDeal = useCallback(() => {
    if (animating()) return
    const cur = stateRef.current
    const layout = layoutRef.current
    if (!cur) return
    if (!canDeal(cur)) {
      toast.warning(t(cur.stock.length < DEAL_SIZE ? 'noStock' : 'dealBlocked'))
      return
    }
    const placed = placeDeal(cur)
    if (!placed) return
    if (!layout) {
      finishAction(placed, cur)
      return
    }

    const dealsLeft = Math.floor(cur.stock.length / DEAL_SIZE)
    const from = stockTopRect(layout, dealsLeft)
    const mini = from.w / layout.cardW
    const flights: Flight[] = Array.from({ length: COLS }, (_, col) => {
      const card = cur.stock[cur.stock.length - 1 - col]
      const dest = cur.tableau[col] ?? []
      return {
        card: card!,
        x0: from.x,
        y0: from.y,
        x1: layout.colX[col] ?? 0,
        y1: cardRect(dest, col, dest.length, layout).y,
        delay: col * DEAL_STAGGER,
        scale0: mini,
        scale1: 1,
        faceUp: true,
        duration: DEAL_CARD_MS,
      }
    }).filter((f) => f.card)

    setSelected(null)
    playShuffleSound()
    startBatch(flights, () => finishAction(placed, cur), {
      stockPending: flights.length,
      total: DEAL_CARD_MS + DEAL_STAGGER * (COLS - 1),
      fallbackDuration: DEAL_CARD_MS,
    })
  }, [finishAction, startBatch, t])

  const undo = useCallback(() => {
    if (animating() || busy) return
    const stack = useSpiderStore.getState().undoStack
    if (stack.length === 0) return
    const prev = stack[stack.length - 1]
    if (!prev) return

    const cur = stateRef.current
    const layout = layoutRef.current
    const applyPrev = () => {
      winShownRef.current = false
      closeModal(WIN_MODAL_ID)
      closeModal(LOSE_MODAL_ID)
      const next = cloneState(prev)
      setGameState(next)
      useSpiderStore.getState().setUndoStack((s) => s.slice(0, -1))
      setRunning(!prev.won && !prev.lost)
      setSelected(null)
      setBusy(false)
    }

    if (!layout || !cur) {
      applyPrev()
      return
    }

    const flights = buildUndoFlights(cur, prev, layout)
    if (flights.length === 0) {
      applyPrev()
      return
    }

    if (isUndoDeal(cur, prev, flights)) playShuffleSound()

    setSelected(null)
    startBatch(flights, applyPrev, { fallbackDuration: UNDO_CARD_MS })
  }, [busy, setGameState, startBatch])

  const toCanvasPoint = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleClick = (col: number | null, pack: DragPack | null) => {
    const sel = selectedRef.current
    const layout = layoutRef.current
    const cur = stateRef.current
    if (sel && layout && cur && col != null && col !== sel.col) {
      const origin = cardRect(cur.tableau[sel.col] ?? [], sel.col, sel.index, layout)
      if (tryMoveTo(sel.col, sel.index, col, { x: origin.x, y: origin.y - 5 })) return
    }
    if (pack && sel && pack.col === sel.col && pack.index === sel.index) {
      setSelected(null)
      return
    }
    if (pack) {
      setSelected({ col: pack.col, index: pack.index })
      return
    }
    if (col == null) setSelected(null)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = stateRef.current
    if (!cur || cur.won || cur.lost || animating()) return
    const layout = layoutRef.current
    if (!layout) return
    const p = toCanvasPoint(e)
    if (hitTestStock(layout, p.x, p.y)) {
      tryDeal()
      return
    }
    const hit = hitTestCard(cur, layout, p.x, p.y, new Set())
    const packHit = hit ? pickupFromHit(cur, hit) : null
    const origin = packHit ? cardRect(cur.tableau[packHit.col]!, packHit.col, packHit.index, layout) : null
    pendingRef.current = {
      startX: p.x,
      startY: p.y,
      col: hit?.col ?? hitTestColumn(cur, layout, p.x, p.y),
      pack:
        packHit && origin
          ? {
              ...packHit,
              grabX: p.x - origin.x,
              grabY: p.y - origin.y,
              originX: origin.x,
              originY: origin.y,
            }
          : null,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toCanvasPoint(e)
    const pending = pendingRef.current
    if (pending?.pack && !dragRef.current) {
      const dist = Math.hypot(p.x - pending.startX, p.y - pending.startY)
      if (dist >= DRAG_PX) {
        dragRef.current = pending.pack
        ghostRef.current = { x: p.x - pending.pack.grabX, y: p.y - pending.pack.grabY }
        pendingRef.current = null
        setSelected({ col: pending.pack.col, index: pending.pack.index })
        kickLoop()
      }
    }
    const drag = dragRef.current
    if (!drag) return
    ghostRef.current = { x: p.x - drag.grabX, y: p.y - drag.grabY }
    paintRef.current()
  }

  const finishDrop = (p: { x: number; y: number }) => {
    const drag = dragRef.current
    const layout = layoutRef.current
    if (!drag || !layout || animRef.current) return
    const toCol = dropColumnAt(layout, (ghostRef.current?.x ?? p.x) + layout.cardW / 2)
    const ghost = ghostRef.current ?? { x: drag.originX, y: drag.originY }
    if (tryMoveTo(drag.col, drag.index, toCol, ghost)) return
    snapTo(drag.cards, ghost, { x: drag.originX, y: drag.originY }, () => {
      dragRef.current = null
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pending = pendingRef.current
    pendingRef.current = null
    if (dragRef.current) {
      finishDrop(toCanvasPoint(e))
      return
    }
    if (pending) handleClick(pending.col, pending.pack)
  }

  const cancelPointer = () => {
    const pending = pendingRef.current
    pendingRef.current = null
    if (dragRef.current) {
      const drag = dragRef.current
      finishDrop({ x: drag.originX + drag.grabX, y: drag.originY + drag.grabY })
      return
    }
    if (pending) handleClick(pending.col, pending.pack)
  }

  if (!hydrated || !state) {
    return (
      <div className={cn(embeddedAppShell(embedded, 'flex min-h-0 min-w-0 flex-col overflow-hidden bg-window text-on-chrome font-pixel'))}>
        <div className={cn(winChromeSunken, 'relative m-2 min-h-0 flex-1 overflow-hidden bg-[#0a6b3c]')} />
      </div>
    )
  }

  const dealsLeft = Math.floor(state.stock.length / DEAL_SIZE)
  const locked = busy || state.won || state.lost

  return (
    <div className={cn(embeddedAppShell(embedded, 'flex min-h-0 min-w-0 flex-col overflow-hidden bg-window text-on-chrome font-pixel'))}>
      <div className='flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 border-b border-chrome-dark px-2 py-1.5'>
        <Button size='sm' className='px-2' onClick={() => void confirmRestart()}>
          {t('newGame')}
        </Button>
        <Button size='sm' className='px-2' disabled={locked || !canDeal(state)} onClick={tryDeal}>
          {t('deal')} ({dealsLeft})
        </Button>
        <Button size='sm' className='px-2' disabled={busy || state.won || undoStack.length === 0} onClick={undo}>
          {t('undo')}
        </Button>
        <Select
          size='sm'
          className='w-[9rem] shrink-0'
          aria-label={t('difficulty')}
          value={String(difficulty)}
          disabled={locked}
          options={DIFFICULTIES.map((d) => ({ value: String(d), label: t(`diff${d}`) }))}
          onValueChange={(v) => {
            const next = Number(v) as Difficulty
            if (next === difficulty) return
            restart(next)
          }}
        />
        <span className='ml-auto min-w-0 truncate tabular-nums text-[11px] text-muted'>
          {t('stats', { moves: state.moves, time: formatTime(elapsed), score: scoreWithTimeBonus(state, elapsed) })}
        </span>
      </div>

      <div className={cn(winChromeSunken, 'relative m-2 min-h-0 flex-1 overflow-hidden bg-[#0a6b3c]')}>
        <div ref={wrapRef} className='h-full min-h-0 w-full'>
          <canvas
            ref={canvasRef}
            className='block h-full w-full cursor-pointer touch-none select-none'
            role='img'
            aria-label={t('boardLabel')}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancelPointer}
            onLostPointerCapture={cancelPointer}
          />
        </div>
      </div>
    </div>
  )
}
