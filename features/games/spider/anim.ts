import { cardRect, foundationRect, stockTopRect, type Layout } from './render'
import { COLS, DEAL_SIZE, RUN_LEN, type Card, type SpiderState } from './types'

export const SNAP_MS = 220
export const FLIP_MS = 200
export const DEAL_CARD_MS = 320
export const DEAL_STAGGER = 42
export const COLLECT_CARD_MS = 420
export const COLLECT_STAGGER = 18
export const COLLECT_RUN_GAP = 160
export const UNDO_CARD_MS = 300
export const UNDO_STAGGER = 24
export const DRAG_PX = 8

export type Flight = {
  card: Card
  x0: number
  y0: number
  x1: number
  y1: number
  delay: number
  scale0?: number
  scale1?: number
  faceUp?: boolean
  duration?: number
  /** 撤销发牌飞回牌堆 */
  undoDeal?: boolean
}

export type FlightBatch = {
  flights: Flight[]
  start: number
  total: number
  onDone: () => void
  /** 发牌动画期间从牌堆扣减的张数（用于绘制剩余发牌次数） */
  stockPending?: number
}

export type DrawnFlight = {
  card: Card
  x: number
  y: number
  scale?: number
  faceUp?: boolean
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function easeOut(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) * (1 - u)
}

export function flippedIdAfter(cur: SpiderState, fromCol: number, fromIndex: number): number | undefined {
  const uncovered = fromIndex > 0 ? cur.tableau[fromCol]?.[fromIndex - 1] : undefined
  return uncovered && !uncovered.faceUp ? uncovered.id : undefined
}

export function newlyFlippedId(before: SpiderState, after: SpiderState): number | undefined {
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

function tableauCardMap(state: SpiderState, layout: Layout) {
  const map = new Map<number, { card: Card; x: number; y: number; faceUp: boolean }>()
  for (let col = 0; col < COLS; col++) {
    const pile = state.tableau[col] ?? []
    for (let i = 0; i < pile.length; i++) {
      const card = pile[i]!
      const r = cardRect(pile, col, i, layout)
      map.set(card.id, { card, x: r.x, y: r.y, faceUp: card.faceUp })
    }
  }
  return map
}

function batchTotal(flights: Flight[], fallbackDuration: number): number {
  if (flights.length === 0) return 0
  return Math.max(...flights.map((f) => f.delay + (f.duration ?? fallbackDuration)))
}

/** 把 Flight 批次插值成当前帧绘制用的飞牌列表 */
export function sampleFlights(batch: FlightBatch, now: number, fallbackDuration: number): DrawnFlight[] {
  const out: DrawnFlight[] = []
  for (const f of batch.flights) {
    const dur = f.duration ?? fallbackDuration
    const p = easeOut((now - batch.start - f.delay) / dur)
    const s0 = f.scale0 ?? 1
    const s1 = f.scale1 ?? 1
    out.push({
      card: f.card,
      x: f.x0 + (f.x1 - f.x0) * p,
      y: f.y0 + (f.y1 - f.y0) * p,
      scale: s0 + (s1 - s0) * p,
      faceUp: f.faceUp ?? true,
    })
  }
  return out
}

export function createFlightBatch(
  flights: Flight[],
  onDone: () => void,
  opts?: { fallbackDuration?: number; stockPending?: number; total?: number },
): FlightBatch {
  const fallback = opts?.fallbackDuration ?? DEAL_CARD_MS
  return {
    flights,
    start: performance.now(),
    total: opts?.total ?? batchTotal(flights, fallback),
    onDone,
    stockPending: opts?.stockPending,
  }
}

/** 撤销时从当前局面飞回上一局面 */
export function buildUndoFlights(cur: SpiderState, prev: SpiderState, layout: Layout): Flight[] {
  const fromMap = tableauCardMap(cur, layout)
  const toMap = tableauCardMap(prev, layout)
  const curIds = new Set<number>([...fromMap.keys(), ...cur.stock.map((c) => c.id)])
  const flights: Flight[] = []
  let delay = 0
  const mini = stockTopRect(layout, 1).w / layout.cardW

  // 收牌撤销：从右下收牌区飞回列
  const missing = prev.tableau.flat().filter((c) => !curIds.has(c.id))
  const foundStart = Math.max(0, prev.completed.length)
  missing.forEach((card, i) => {
    const dest = toMap.get(card.id)
    if (!dest) return
    const rect = foundationRect(layout, foundStart + Math.floor(i / RUN_LEN))
    flights.push({
      card,
      x0: rect.x,
      y0: rect.y,
      x1: dest.x,
      y1: dest.y,
      delay,
      scale0: mini,
      scale1: 1,
      faceUp: true,
      duration: UNDO_CARD_MS,
    })
    delay += UNDO_STAGGER
  })

  // 列间移动撤销
  for (const [, dest] of toMap) {
    const src = fromMap.get(dest.card.id)
    if (!src) continue
    if (Math.abs(src.x - dest.x) < 0.5 && Math.abs(src.y - dest.y) < 0.5) continue
    flights.push({
      card: dest.card,
      x0: src.x,
      y0: src.y,
      x1: dest.x,
      y1: dest.y,
      delay,
      scale0: 1,
      scale1: 1,
      faceUp: dest.faceUp,
      duration: UNDO_CARD_MS,
    })
    delay += UNDO_STAGGER
  }

  // 发牌撤销：列顶牌飞回左下发牌堆
  const stockTarget = stockTopRect(layout, Math.max(1, Math.floor(prev.stock.length / DEAL_SIZE)))
  for (const card of prev.stock) {
    const src = fromMap.get(card.id)
    if (!src) continue
    flights.push({
      card,
      x0: src.x,
      y0: src.y,
      x1: stockTarget.x,
      y1: stockTarget.y,
      delay,
      scale0: 1,
      scale1: mini,
      faceUp: false,
      duration: UNDO_CARD_MS,
      undoDeal: true,
    })
    delay += UNDO_STAGGER
  }

  return flights
}

export function isUndoDeal(cur: SpiderState, prev: SpiderState, flights: Flight[]): boolean {
  return prev.stock.length - cur.stock.length === DEAL_SIZE && flights.some((f) => f.undoDeal)
}
