import {
  COLS,
  COMPLETE_BONUS,
  COMPLETE_RUNS,
  DEAL_SIZE,
  RUN_LEN,
  START_SCORE,
  SUITS,
  TOTAL_CARDS,
  type Card,
  type Difficulty,
  type HintMove,
  type Rank,
  type SpiderState,
  type Suit,
} from './types'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

function cloneCards(cards: readonly Card[]): Card[] {
  return cards.map((c) => ({ ...c }))
}

export function cloneState(state: SpiderState): SpiderState {
  return {
    tableau: state.tableau.map(cloneCards),
    stock: cloneCards(state.stock),
    completed: state.completed.slice(),
    moves: state.moves,
    score: state.score,
    difficulty: state.difficulty,
    won: state.won,
    lost: state.lost,
  }
}

function cardCount(state: SpiderState): number {
  return state.tableau.reduce((n, col) => n + col.length, 0) + state.stock.length + state.completed.length * RUN_LEN
}

function inventoryOk(state: SpiderState): boolean {
  const ids = new Set<number>()
  for (const col of state.tableau) {
    for (const card of col) {
      if (ids.has(card.id)) return false
      ids.add(card.id)
    }
  }
  for (const card of state.stock) {
    if (ids.has(card.id)) return false
    ids.add(card.id)
  }
  return ids.size + state.completed.length * RUN_LEN === TOTAL_CARDS
}

function recomputeScore(moves: number, completed: number): number {
  return START_SCORE - moves + completed * COMPLETE_BONUS
}

function copiesForDifficulty(difficulty: Difficulty): number[] {
  if (difficulty === 1) return [12]
  if (difficulty === 2) return [6, 6]
  if (difficulty === 3) return [4, 4, 4]
  return [3, 3, 3, 3]
}

/**
 * Build the deck from blocks of 13 (one of each rank), so every rank
 * appears once per block. Small rotations/swaps add randomness without
 * long droughts or heavy same-rank clumps from a pure shuffle.
 */
function distributeBalanced(byRank: Card[][], rng: () => number): Card[] {
  const copies = byRank[0]!.length
  const rankOrder = byRank.map((_, i) => i)
  shuffle(rankOrder, rng)

  const blocks: Card[][] = []
  for (let copy = 0; copy < copies; copy++) {
    const block = rankOrder.map((ri) => byRank[ri]![copy]!)
    const rot = Math.floor(rng() * RUN_LEN)
    const rotated = block.slice(rot).concat(block.slice(0, rot))
    // A few adjacent swaps keep local variety without breaking even spread.
    const swaps = 2 + Math.floor(rng() * 3)
    for (let s = 0; s < swaps; s++) {
      const i = Math.floor(rng() * (RUN_LEN - 1))
      const tmp = rotated[i]!
      rotated[i] = rotated[i + 1]!
      rotated[i + 1] = tmp
    }
    blocks.push(rotated)
  }

  // Avoid same-rank touching across block boundaries.
  for (let b = 1; b < blocks.length; b++) {
    const prev = blocks[b - 1]!
    const cur = blocks[b]!
    const lastRank = prev[prev.length - 1]!.rank
    if (cur[0]!.rank !== lastRank) continue
    for (let i = 1; i < cur.length; i++) {
      if (cur[i]!.rank === lastRank) continue
      if (i + 1 < cur.length && cur[i + 1]!.rank === lastRank) continue
      const tmp = cur[0]!
      cur[0] = cur[i]!
      cur[i] = tmp
      break
    }
  }

  return blocks.flat()
}

function buildDeck(difficulty: Difficulty, rng: () => number): Card[] {
  const copies = copiesForDifficulty(difficulty)
  const byRank: Card[][] = Array.from({ length: 13 }, () => [])
  let id = 0
  for (let s = 0; s < copies.length; s++) {
    const suit = SUITS[s]!
    const n = copies[s]!
    for (let copy = 0; copy < n; copy++) {
      for (let rank = 1; rank <= 13; rank++) {
        byRank[rank - 1]!.push({ id: id++, suit, rank: rank as Rank, faceUp: false })
      }
    }
  }
  for (const pile of byRank) shuffle(pile, rng)
  return distributeBalanced(byRank, rng)
}

export function newGame(difficulty: Difficulty, seed = Date.now()): SpiderState {
  const rng = mulberry32(seed)
  const deck = buildDeck(difficulty, rng)
  const tableau: Card[][] = Array.from({ length: COLS }, () => [])
  for (let round = 0; round < 6; round++) {
    for (let col = 0; col < COLS; col++) {
      if (round === 5 && col >= 6) continue
      const card = deck.pop()
      if (!card) throw new Error('deck underflow')
      tableau[col]!.push(card)
    }
  }
  for (const col of tableau) {
    const top = col[col.length - 1]
    if (top) top.faceUp = true
  }
  const state: SpiderState = {
    tableau,
    stock: deck,
    completed: [],
    moves: 0,
    score: START_SCORE,
    difficulty,
    won: false,
    lost: false,
  }
  if (cardCount(state) !== TOTAL_CARDS || !inventoryOk(state)) throw new Error('invalid deal inventory')
  return state
}

function isSameSuitRun(cards: readonly Card[]): boolean {
  if (cards.length === 0) return false
  if (cards.some((c) => !c.faceUp)) return false
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1]!
    const cur = cards[i]!
    if (cur.suit !== prev.suit) return false
    if (cur.rank !== prev.rank - 1) return false
  }
  return true
}

export function canPick(col: readonly Card[], fromIndex: number): boolean {
  if (fromIndex < 0 || fromIndex >= col.length) return false
  return isSameSuitRun(col.slice(fromIndex))
}

function canDrop(moving: readonly Card[], dest: readonly Card[]): boolean {
  if (moving.length === 0) return false
  if (dest.length === 0) return true
  const top = dest[dest.length - 1]
  if (!top?.faceUp) return false
  return top.rank === moving[0]!.rank + 1
}

export type CollectedRun = {
  col: number
  start: number
  cards: Card[]
  suit: Suit
}

function findCompleteRunStart(col: readonly Card[]): number | null {
  if (col.length < RUN_LEN) return null
  const start = col.length - RUN_LEN
  const run = col.slice(start)
  if (run[0]?.rank !== 13) return null
  if (run[RUN_LEN - 1]?.rank !== 1) return null
  if (!isSameSuitRun(run)) return null
  return start
}

export function collectCompleted(state: SpiderState): { state: SpiderState; runs: CollectedRun[] } {
  const next = cloneState(state)
  const runs: CollectedRun[] = []
  for (let colIndex = 0; colIndex < COLS; colIndex++) {
    const col = next.tableau[colIndex]!
    let start = findCompleteRunStart(col)
    while (start != null) {
      const cards = cloneCards(col.slice(start, start + RUN_LEN))
      const suit = cards[0]?.suit
      if (suit) {
        runs.push({ col: colIndex, start, cards, suit })
        next.completed.push(suit)
      }
      col.splice(start, RUN_LEN)
      const nextTop = col[col.length - 1]
      if (nextTop && !nextTop.faceUp) nextTop.faceUp = true
      start = findCompleteRunStart(col)
    }
  }
  next.won = next.completed.length === COMPLETE_RUNS
  next.lost = false
  next.score = recomputeScore(next.moves, next.completed.length)
  if (!next.won) next.lost = !hasLegalMove(next) && !canDeal(next)
  return { state: next, runs }
}

export function placeMove(state: SpiderState, fromCol: number, fromIndex: number, toCol: number): SpiderState | null {
  if (state.won || state.lost) return null
  if (fromCol === toCol) return null
  const src = state.tableau[fromCol]
  const dst = state.tableau[toCol]
  if (!src || !dst) return null
  if (!canPick(src, fromIndex)) return null
  const moving = src.slice(fromIndex)
  if (!canDrop(moving, dst)) return null

  const next = cloneState(state)
  const nextSrc = next.tableau[fromCol]!
  const nextDst = next.tableau[toCol]!
  const pack = nextSrc.splice(fromIndex)
  nextDst.push(...pack)
  const uncovered = nextSrc[nextSrc.length - 1]
  if (uncovered && !uncovered.faceUp) uncovered.faceUp = true
  next.moves += 1
  next.score = recomputeScore(next.moves, next.completed.length)
  if (!inventoryOk(next)) return null
  return next
}

export function canDeal(state: SpiderState): boolean {
  if (state.won || state.lost) return false
  if (state.stock.length < DEAL_SIZE) return false
  return state.tableau.every((col) => col.length > 0)
}

export function placeDeal(state: SpiderState): SpiderState | null {
  if (!canDeal(state)) return null
  const next = cloneState(state)
  for (let i = 0; i < COLS; i++) {
    const card = next.stock.pop()
    if (!card) return null
    card.faceUp = true
    next.tableau[i]!.push(card)
  }
  next.moves += 1
  next.score = recomputeScore(next.moves, next.completed.length)
  if (!inventoryOk(next)) return null
  return next
}

function hasLegalMove(state: SpiderState): boolean {
  for (let fromCol = 0; fromCol < COLS; fromCol++) {
    const src = state.tableau[fromCol]!
    for (let fromIndex = 0; fromIndex < src.length; fromIndex++) {
      if (!canPick(src, fromIndex)) continue
      const moving = src.slice(fromIndex)
      for (let toCol = 0; toCol < COLS; toCol++) {
        if (fromCol === toCol) continue
        if (canDrop(moving, state.tableau[toCol]!)) return true
      }
    }
  }
  return false
}

/** 提示用：排除无意义重排，优先同花接龙 / 翻牌 / 为发牌填空列 */
function isUsefulMove(state: SpiderState, fromCol: number, fromIndex: number, toCol: number): boolean {
  if (fromCol === toCol) return false
  const src = state.tableau[fromCol]
  const dest = state.tableau[toCol]
  if (!src || !dest) return false
  if (!canPick(src, fromIndex)) return false
  const moving = src.slice(fromIndex)
  if (!canDrop(moving, dest)) return false

  const under = fromIndex > 0 ? src[fromIndex - 1] : undefined
  if (under && !under.faceUp) return true

  const destTop = dest[dest.length - 1]
  if (destTop && destTop.suit === moving[0]!.suit) return true

  const canDealLater = state.stock.length >= DEAL_SIZE
  if (dest.length === 0 && fromIndex > 0 && canDealLater) return true

  if (fromIndex === 0) return false
  if (under?.faceUp && under.rank === moving[0]!.rank + 1) return false
  return true
}

export function findHint(state: SpiderState): HintMove | null {
  if (state.won || state.lost) return null
  const cols = state.tableau
  let fallback: HintMove | null = null
  for (let fromCol = 0; fromCol < COLS; fromCol++) {
    const src = cols[fromCol]!
    for (let fromIndex = 0; fromIndex < src.length; fromIndex++) {
      for (let toCol = 0; toCol < COLS; toCol++) {
        if (!isUsefulMove(state, fromCol, fromIndex, toCol)) continue
        const hint = { fromCol, fromIndex, toCol }
        const destTop = cols[toCol]?.at(-1)
        const moving = src[fromIndex]
        if (destTop && moving && destTop.suit === moving.suit) return hint
        if (!fallback) fallback = hint
      }
    }
  }
  return fallback
}

export function scoreWithTimeBonus(state: SpiderState, elapsedSec: number): number {
  const timeBonus = state.won ? Math.max(0, 300 - elapsedSec) : 0
  return state.score + timeBonus
}
