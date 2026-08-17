'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Select, closeModal, openModal, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChromeSunken } from '@/lib/winChrome'
import {
  canDeal,
  cloneState,
  collectCompleted,
  findHint,
  newGame,
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
  hitTestCard,
  hitTestColumn,
  hitTestStock,
  pickupFromHit,
  setupHiDpiCanvas,
  type Layout,
} from './render'
import { COLS, DIFFICULTIES, type Card, type Difficulty, type HintMove, type SpiderState } from './types'

export type SpiderProps = {
  embedded?: boolean
}

const WIN_MODAL_ID = 'spider-win'
const LOSE_MODAL_ID = 'spider-lose'
const SNAP_MS = 220
const FLIP_MS = 200
const DEAL_CARD_MS = 320
const DEAL_STAGGER = 42
const COLLECT_CARD_MS = 420
const COLLECT_STAGGER = 18
const COLLECT_RUN_GAP = 160
const DRAG_PX = 8

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

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function easeOut(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) * (1 - u)
}

function flippedIdAfter(cur: SpiderState, fromCol: number, fromIndex: number): number | undefined {
  const uncovered = fromIndex > 0 ? cur.tableau[fromCol]?.[fromIndex - 1] : undefined
  return uncovered && !uncovered.faceUp ? uncovered.id : undefined
}

function newlyFlippedId(before: SpiderState, after: SpiderState): number | undefined {
  const faceUp = new Set<number>()
  for (const col of after.tableau) {
    for (const card of col) {
      if (card.faceUp) faceUp.add(card.id)
    }
  }
  for (const col of before.tableau) {
    for (const card of col) {
      if (!card.faceUp && faceUp.has(card.id)) return card.id
    }
  }
}

export function Spider({ embedded = false }: SpiderProps) {
  const t = useTranslations('spider')
  const [difficulty, setDifficulty] = useState<Difficulty>(2)
  const [state, setState] = useState<SpiderState>(() => newGame(2))
  const [undoStack, setUndoStack] = useState<SpiderState[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [hint, setHint] = useState<HintMove | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [busy, setBusy] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layoutRef = useRef<Layout | null>(null)
  const stateRef = useRef(state)
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
  const dealRef = useRef<{
    flights: { card: Card; x0: number; y0: number; x1: number; y1: number; delay: number }[]
    start: number
    total: number
    onDone: () => void
  } | null>(null)
  const collectRef = useRef<{
    flights: { card: Card; x0: number; y0: number; x1: number; y1: number; delay: number }[]
    start: number
    total: number
    onDone: () => void
  } | null>(null)
  const flipRef = useRef<{ id: number; start: number } | null>(null)
  const rafRef = useRef(0)
  const winShownRef = useRef(false)
  const hintTimerRef = useRef(0)
  const genRef = useRef(0)

  stateRef.current = state
  selectedRef.current = selected

  const pushUndo = useCallback((prev: SpiderState) => {
    setUndoStack((stack) => [...stack, cloneState(prev)])
  }, [])

  const restart = useCallback(
    (nextDiff = difficulty) => {
      genRef.current += 1
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      winShownRef.current = false
      dragRef.current = null
      pendingRef.current = null
      animRef.current = null
      dealRef.current = null
      collectRef.current = null
      flipRef.current = null
      ghostRef.current = null
      closeModal(WIN_MODAL_ID)
      closeModal(LOSE_MODAL_ID)
      setDifficulty(nextDiff)
      setState(newGame(nextDiff))
      setUndoStack([])
      setElapsed(0)
      setRunning(false)
      setHint(null)
      setSelected(null)
      setBusy(false)
    },
    [difficulty],
  )

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (w < 8 || h < 8) return
    const ctx = setupHiDpiCanvas(canvas, w, h)
    if (!ctx) return
    const layout = computeLayout(w, h)
    layoutRef.current = layout
    const drag = dragRef.current
    const hidden = new Set<number>()
    let ghost: { cards: Card[]; x: number; y: number } | undefined
    if (drag && ghostRef.current) {
      for (const c of drag.cards) hidden.add(c.id)
      ghost = { cards: drag.cards, x: ghostRef.current.x, y: ghostRef.current.y }
    }
    const anim = animRef.current
    if (anim) {
      const t0 = easeOut((performance.now() - anim.start) / SNAP_MS)
      for (const c of anim.cards) hidden.add(c.id)
      ghost = {
        cards: anim.cards,
        x: anim.x0 + (anim.x1 - anim.x0) * t0,
        y: anim.y0 + (anim.y1 - anim.y0) * t0,
      }
    }
    const flights: { card: Card; x: number; y: number; scale?: number }[] = []
    const now = performance.now()
    const deal = dealRef.current
    if (deal) {
      for (const f of deal.flights) {
        hidden.add(f.card.id)
        const p = easeOut((now - deal.start - f.delay) / DEAL_CARD_MS)
        flights.push({
          card: f.card,
          x: f.x0 + (f.x1 - f.x0) * p,
          y: f.y0 + (f.y1 - f.y0) * p,
        })
      }
    }
    const collect = collectRef.current
    if (collect) {
      const mini = Math.min(layout.cardW, 34) / layout.cardW
      for (const f of collect.flights) {
        hidden.add(f.card.id)
        const p = easeOut((now - collect.start - f.delay) / COLLECT_CARD_MS)
        flights.push({
          card: f.card,
          x: f.x0 + (f.x1 - f.x0) * p,
          y: f.y0 + (f.y1 - f.y0) * p,
          scale: 1 - p * (1 - mini),
        })
      }
    }
    let flip: { id: number; scaleX: number; showFace: boolean } | undefined
    if (flipRef.current) {
      const p = Math.min(1, (performance.now() - flipRef.current.start) / FLIP_MS)
      const scaleX = p < 0.5 ? 1 - p * 2 : p * 2 - 1
      flip = { id: flipRef.current.id, scaleX: Math.max(0.04, scaleX), showFace: p >= 0.5 }
    }
    drawSpider(ctx, stateRef.current, layout, {
      hiddenIds: hidden,
      ghost,
      flights: flights.length ? flights : undefined,
      hint,
      active: selectedRef.current,
      flip,
      stockPending: deal ? deal.flights.length : 0,
    })
  }, [hint])

  const paintRef = useRef(paint)
  paintRef.current = paint

  const looping = () =>
    Boolean(animRef.current || flipRef.current || dragRef.current || dealRef.current || collectRef.current)

  const kickLoop = useCallback(() => {
    if (rafRef.current) return
    const loop = () => {
      const now = performance.now()
      const anim = animRef.current
      const flip = flipRef.current
      const deal = dealRef.current
      const collect = collectRef.current
      if (anim && now - anim.start >= SNAP_MS) {
        const done = anim.onDone
        animRef.current = null
        done()
      }
      if (flip && now - flip.start >= FLIP_MS) flipRef.current = null
      if (deal && now - deal.start >= deal.total) {
        const done = deal.onDone
        dealRef.current = null
        done()
      }
      if (collect && now - collect.start >= collect.total) {
        const done = collect.onDone
        collectRef.current = null
        done()
      }
      paintRef.current()
      if (looping()) rafRef.current = window.requestAnimationFrame(loop)
      else rafRef.current = 0
    }
    rafRef.current = window.requestAnimationFrame(loop)
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => paint())
    ro.observe(wrap)
    paint()
    return () => ro.disconnect()
  }, [paint])

  useEffect(() => {
    paint()
  }, [paint, state, selected])

  useEffect(() => {
    if (!running || state.won || state.lost) return
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [running, state.won, state.lost])

  useEffect(() => {
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
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      animRef.current = null
      dealRef.current = null
      collectRef.current = null
      flipRef.current = null
      dragRef.current = null
      pendingRef.current = null
      window.clearTimeout(hintTimerRef.current)
    }
  }, [])

  const commit = useCallback(
    (next: SpiderState, prev: SpiderState, flippedId?: number) => {
      pushUndo(prev)
      stateRef.current = next
      setState(next)
      setRunning(true)
      setHint(null)
      setSelected(null)
      if (next.won || next.lost) setRunning(false)
      if (flippedId != null) {
        flipRef.current = { id: flippedId, start: performance.now() }
        kickLoop()
      }
    },
    [kickLoop, pushUndo],
  )

  const playCollect = useCallback(
    (placed: SpiderState, runs: CollectedRun[], onDone: () => void) => {
      const layout = layoutRef.current
      if (!layout || runs.length === 0) {
        onDone()
        return
      }
      const destH = Math.min(layout.cardH, 48)
      const flights: { card: Card; x0: number; y0: number; x1: number; y1: number; delay: number }[] = []
      let total = 0
      runs.forEach((run, ri) => {
        const pile = placed.tableau[run.col] ?? []
        const x1 = layout.foundations.x + (placed.completed.length + ri) * 10
        const y1 = layout.foundations.y - destH + layout.foundations.h
        run.cards.forEach((card, i) => {
          const idx = pile.findIndex((c) => c.id === card.id)
          const r = idx >= 0 ? cardRect(pile, run.col, idx, layout) : { x: x1, y: y1 }
          const delay = ri * COLLECT_RUN_GAP + i * COLLECT_STAGGER
          flights.push({ card, x0: r.x, y0: r.y, x1, y1, delay })
          total = Math.max(total, delay + COLLECT_CARD_MS)
        })
      })
      const gen = genRef.current
      setBusy(true)
      collectRef.current = {
        flights,
        start: performance.now(),
        total,
        onDone: () => {
          setBusy(false)
          if (genRef.current !== gen) return
          onDone()
        },
      }
      kickLoop()
    },
    [kickLoop],
  )

  const finishAction = useCallback(
    (placed: SpiderState, prev: SpiderState, flippedId?: number) => {
      const { state: next, runs } = collectCompleted(placed)
      if (runs.length === 0) {
        commit(next, prev, flippedId)
        return
      }
      stateRef.current = placed
      setState(placed)
      setRunning(true)
      setHint(null)
      setSelected(null)
      if (flippedId != null) {
        flipRef.current = { id: flippedId, start: performance.now() }
        kickLoop()
      }
      playCollect(placed, runs, () => {
        const uncover = newlyFlippedId(placed, next)
        commit(next, prev, uncover)
      })
    },
    [commit, kickLoop, playCollect],
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
      if (!layout) return false
      const placed = placeMove(cur, fromCol, fromIndex, toCol)
      if (!placed) return false
      const pack = cur.tableau[fromCol]?.slice(fromIndex) ?? []
      const destPile = cur.tableau[toCol] ?? []
      snapTo(pack, fromPos, { x: layout.colX[toCol] ?? 0, y: cardRect(destPile, toCol, destPile.length, layout).y }, () =>
        finishAction(placed, cur, flippedIdAfter(cur, fromCol, fromIndex)),
      )
      return true
    },
    [finishAction, snapTo],
  )

  const tryDeal = useCallback(() => {
    if (dealRef.current || animRef.current || collectRef.current) return
    const cur = stateRef.current
    const layout = layoutRef.current
    if (!canDeal(cur)) {
      toast.warning(t(cur.stock.length < 10 ? 'noStock' : 'dealBlocked'))
      return
    }
    const placed = placeDeal(cur)
    if (!placed) return
    if (!layout) {
      finishAction(placed, cur)
      return
    }

    const stockCardH = Math.min(layout.cardH, 48)
    const x0 = layout.stock.x
    const y0 = layout.stock.y - stockCardH + layout.stock.h
    const flights = Array.from({ length: COLS }, (_, col) => {
      const card = cur.stock[cur.stock.length - 1 - col]
      const dest = cur.tableau[col] ?? []
      return {
        card: card!,
        x0,
        y0,
        x1: layout.colX[col] ?? 0,
        y1: cardRect(dest, col, dest.length, layout).y,
        delay: col * DEAL_STAGGER,
      }
    }).filter((f) => f.card)

    const gen = genRef.current
    setBusy(true)
    setSelected(null)
    dealRef.current = {
      flights,
      start: performance.now(),
      total: DEAL_CARD_MS + DEAL_STAGGER * (COLS - 1),
      onDone: () => {
        setBusy(false)
        if (genRef.current !== gen) return
        finishAction(placed, cur)
      },
    }
    kickLoop()
  }, [finishAction, kickLoop, t])

  const tryHint = useCallback(() => {
    const found = findHint(stateRef.current)
    if (!found) {
      toast.warning(t('noHint'))
      setHint(null)
      return
    }
    setHint(found)
    window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => setHint(null), 2400)
  }, [t])

  const undo = useCallback(() => {
    if (dealRef.current || animRef.current || collectRef.current) return
    setUndoStack((stack) => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      if (prev) {
        winShownRef.current = false
        closeModal(WIN_MODAL_ID)
        closeModal(LOSE_MODAL_ID)
        setState(cloneState(prev))
        setRunning(!prev.won && !prev.lost)
        setHint(null)
        setSelected(null)
      }
      return stack.slice(0, -1)
    })
  }, [])

  const toCanvasPoint = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleClick = (col: number | null, pack: DragPack | null) => {
    const sel = selectedRef.current
    const layout = layoutRef.current
    if (sel && layout && col != null && col !== sel.col) {
      const origin = cardRect(stateRef.current.tableau[sel.col] ?? [], sel.col, sel.index, layout)
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
    if (stateRef.current.won || stateRef.current.lost || animRef.current || dealRef.current || collectRef.current) return
    const layout = layoutRef.current
    if (!layout) return
    const p = toCanvasPoint(e)
    if (hitTestStock(layout, p.x, p.y)) {
      tryDeal()
      return
    }
    const cur = stateRef.current
    const hit = hitTestCard(cur, layout, p.x, p.y, new Set())
    const packHit = hit ? pickupFromHit(cur, hit) : null
    const origin = packHit ? cardRect(cur.tableau[packHit.col]!, packHit.col, packHit.index, layout) : null
    pendingRef.current = {
      startX: p.x,
      startY: p.y,
      col: hit?.col ?? hitTestColumn(cur, layout, p.x, p.y),
      pack: packHit && origin
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

  const dealsLeft = Math.floor(state.stock.length / 10)
  const locked = busy || state.won || state.lost

  return (
    <div className={cn(embeddedAppShell(embedded, 'flex min-h-0 flex-col bg-window text-on-chrome font-pixel'))}>
      <div className='flex shrink-0 flex-wrap items-center gap-1.5 border-b border-chrome-dark px-2 py-1.5'>
        <Button size='sm' className='px-2' onClick={() => restart()}>
          {t('newGame')}
        </Button>
        <Button size='sm' className='px-2' disabled={locked || !canDeal(state)} onClick={tryDeal}>
          {t('deal')} ({dealsLeft})
        </Button>
        <Button size='sm' className='px-2' disabled={busy || state.won || undoStack.length === 0} onClick={undo}>
          {t('undo')}
        </Button>
        <Button size='sm' className='px-2' disabled={locked} onClick={tryHint}>
          {t('hint')}
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
        <span className='ml-auto tabular-nums text-[11px] text-muted'>
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
