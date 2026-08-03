import {
  CARD_HEIGHT,
  CARD_WIDTH,
  MATCH_COUNT,
  PATTERNS,
  SLOT_CAPACITY,
  type BoardCard,
  type GameStatus,
  type PatternId,
  type Rect,
  type TileMatchState,
  type UndoEntry,
} from './types'

const BOARD_WIDTH = 320
const BOARD_HEIGHT = 280
const DEFAULT_SHUFFLE = 2
const DEFAULT_UNDO = 3
/** 约原先 36/39/42 的 3 倍 */
const TARGET_CARD_BASE = 108
const TARGET_CARD_STEP = 9 // 108 / 117 / 126

function rectsOverlap(a: Rect, b: Rect, inset = 1): boolean {
  const ax1 = a.x + inset
  const ay1 = a.y + inset
  const ax2 = a.x + a.width - inset
  const ay2 = a.y + a.height - inset
  const bx1 = b.x + inset
  const by1 = b.y + inset
  const bx2 = b.x + b.width - inset
  const by2 = b.y + b.height - inset
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
}

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
}

function countRemaining(cards: BoardCard[]): number {
  return cards.filter((c) => c.status === 'board').length
}

/** other 是否叠在 card 之上（与渲染 z 序一致） */
function isStackedAbove(other: BoardCard, card: BoardCard): boolean {
  if (other.layer !== card.layer) return other.layer > card.layer
  if (other.y !== card.y) return other.y > card.y
  if (other.x !== card.x) return other.x > card.x
  return other.id > card.id
}

/** 被任意叠在上方且矩形相交的卡牌遮挡则不可点 */
export function isCardBlocked(card: BoardCard, cards: readonly BoardCard[]): boolean {
  if (card.status !== 'board') return true
  const self: Rect = { x: card.x, y: card.y, width: card.width, height: card.height }
  return cards.some(
    (other) =>
      other.id !== card.id &&
      other.status === 'board' &&
      isStackedAbove(other, card) &&
      rectsOverlap(self, { x: other.x, y: other.y, width: other.width, height: other.height }),
  )
}

export function isCardClickable(card: BoardCard, cards: readonly BoardCard[]): boolean {
  return card.status === 'board' && !isCardBlocked(card, cards)
}

/** 校验：每种仍在场（board/slot/clearing）的图案数量必须是 3 的倍数 */
export function assertPatternMultiples(cards: readonly BoardCard[]): boolean {
  const counts = new Map<PatternId, number>()
  for (const c of cards) {
    if (c.status === 'removed') continue
    counts.set(c.pattern, (counts.get(c.pattern) ?? 0) + 1)
  }
  for (const n of counts.values()) {
    if (n % MATCH_COUNT !== 0) return false
  }
  return true
}

/** 先定容量，再按「每种恰好 k 组（3 张）」装袋，保证可完全消除 */
function buildPatternBag(capacity: number, rng: () => number): PatternId[] {
  const target = capacity - (capacity % MATCH_COUNT)
  if (target < MATCH_COUNT) return []

  const pool = [...PATTERNS]
  shuffleInPlace(pool, rng)

  const bag: PatternId[] = []
  let left = target
  let i = 0

  while (left >= MATCH_COUNT) {
    const pattern = pool[i % pool.length]
    i += 1
    const maxGroups = Math.floor(left / MATCH_COUNT)
    const want = Math.min(maxGroups, 1 + Math.floor(rng() * 3))
    for (let g = 0; g < want * MATCH_COUNT; g++) {
      bag.push(pattern.id)
    }
    left -= want * MATCH_COUNT
  }

  while (left >= MATCH_COUNT) {
    for (let g = 0; g < MATCH_COUNT; g++) bag.push(pool[0].id)
    left -= MATCH_COUNT
  }

  return bag
}

/**
 * 羊了个羊式落点：
 * - 中央不规则交错叠层（半格错位，一牌压多牌）
 * - 左右两侧近乎重合的竖向牌堆（只露顶牌）
 */
function buildSheepPlacements(count: number, rng: () => number): Array<{ layer: number; x: number; y: number }> {
  const placements: Array<{ layer: number; x: number; y: number }> = []

  // —— 左右竖堆：约各占总量 12% ——
  const sideBudget = Math.min(40, Math.max(18, Math.round(count * 0.24)))
  let leftN = Math.floor(sideBudget / 2)
  let rightN = sideBudget - leftN
  // 微调使两侧之和不超过 count-36（中央至少留一层）
  while (leftN + rightN > count - 36 && leftN + rightN > 12) {
    if (leftN >= rightN) leftN -= 1
    else rightN -= 1
  }
  const centerN = count - leftN - rightN

  const pushStack = (baseX: number, baseY: number, n: number, layerStart: number) => {
    // 自下而上叠：底层 y 更大，顶层露出；避免堆顶越出棋盘
    const peek = 3.2
    const startY = Math.min(baseY, BOARD_HEIGHT - CARD_HEIGHT - 4 - peek)
    const topY = startY - (n - 1) * peek
    const shift = topY < 4 ? 4 - topY : 0
    for (let i = 0; i < n; i++) {
      placements.push({
        layer: layerStart + i,
        x: baseX + (i % 2) * 1.2,
        y: startY - i * peek + shift,
      })
    }
  }

  const stackY = Math.round((BOARD_HEIGHT - CARD_HEIGHT) / 2 + 10)
  pushStack(6, stackY, leftN, 0)
  pushStack(BOARD_WIDTH - CARD_WIDTH - 6, stackY, rightN, 0)

  // —— 中央簇：同层网格不重叠，上层半格错位压住下层交点 ——
  const centerLayers = 4
  const stepX = CARD_WIDTH
  const stepY = CARD_HEIGHT
  const cols = 7
  const rows = 5

  // 各层大致均分，略偏向下层
  const perLayer: number[] = []
  let remain = centerN
  for (let L = 0; L < centerLayers; L++) {
    const weight = centerLayers - L + 0.5
    const share =
      L === centerLayers - 1
        ? remain
        : Math.max(6, Math.round((centerN * weight) / ((centerLayers * (centerLayers + 1)) / 2 + centerLayers * 0.5)))
    const take = Math.min(remain, share)
    perLayer.push(take)
    remain -= take
  }
  if (remain > 0) perLayer[0] += remain

  const centerSlots: Array<{ layer: number; x: number; y: number }> = []
  for (let layer = 0; layer < centerLayers; layer++) {
    const brick = layer % 2 === 1
    const offsetX = brick ? stepX * 0.5 : 0
    const offsetY = brick ? stepY * 0.5 : 0
    // 偶数层用满格；奇数层半格错位，行列各少 1 以免出界
    const layerCols = brick ? cols - 1 : cols
    const layerRows = brick ? rows - 1 : rows

    const totalW = (layerCols - 1) * stepX + CARD_WIDTH
    const totalH = (layerRows - 1) * stepY + CARD_HEIGHT
    const marginX = CARD_WIDTH + 14
    let originX = marginX + (BOARD_WIDTH - marginX * 2 - totalW) / 2 + offsetX
    let originY = (BOARD_HEIGHT - totalH) / 2 + offsetY - 2
    originX = Math.max(marginX, Math.min(originX, BOARD_WIDTH - marginX - totalW))
    originY = Math.max(4, Math.min(originY, BOARD_HEIGHT - totalH - 4))

    const candidates: Array<{ x: number; y: number; score: number }> = []
    for (let r = 0; r < layerRows; r++) {
      for (let c = 0; c < layerCols; c++) {
        const nx = (c - (layerCols - 1) / 2) / Math.max(1, layerCols / 2)
        const ny = (r - (layerRows - 1) / 2) / Math.max(1, layerRows / 2)
        const dist = nx * nx * 0.95 + ny * ny * 1.1
        const radius = 1.15 - layer * 0.05
        const jitter = (rng() - 0.5) * 0.12
        if (dist > radius * radius + jitter) continue
        if (layer > 0 && dist < 0.06 && rng() < 0.3) continue

        const x = originX + c * stepX
        const y = originY + r * stepY
        if (x < marginX - 2 || y < 2 || x + CARD_WIDTH > BOARD_WIDTH - marginX + 2 || y + CARD_HEIGHT > BOARD_HEIGHT - 2) {
          continue
        }
        candidates.push({ x, y, score: dist + rng() * 0.04 })
      }
    }
    shuffleInPlace(candidates, rng)

    const want = perLayer[layer] ?? 0
    const keep = Math.min(want, candidates.length)
    for (let k = 0; k < keep; k++) {
      centerSlots.push({ layer, x: candidates[k].x, y: candidates[k].y })
    }
  }

  // 中央不足时在半格错位层补位
  if (centerSlots.length < centerN) {
    const layer = 1
    const offsetX = stepX * 0.5
    const offsetY = stepY * 0.5
    const layerCols = cols - 1
    const layerRows = rows - 1
    const totalW = (layerCols - 1) * stepX + CARD_WIDTH
    const totalH = (layerRows - 1) * stepY + CARD_HEIGHT
    const marginX = CARD_WIDTH + 14
    const originX = marginX + (BOARD_WIDTH - marginX * 2 - totalW) / 2 + offsetX
    const originY = (BOARD_HEIGHT - totalH) / 2 + offsetY
    for (let r = 0; r < layerRows && centerSlots.length < centerN; r++) {
      for (let c = 0; c < layerCols && centerSlots.length < centerN; c++) {
        const x = originX + c * stepX
        const y = originY + r * stepY
        const exists = centerSlots.some((p) => Math.hypot(p.x - x, p.y - y) < 2 && p.layer === layer)
        if (!exists) centerSlots.push({ layer, x, y })
      }
    }
  }

  placements.push(...centerSlots.slice(0, centerN))

  // 若仍不足（极端），在中央顶层再塞（仍避免同层重叠）
  let fill = 0
  while (placements.length < count) {
    const c = fill % 6
    const r = Math.floor(fill / 6)
    placements.push({
      layer: 3,
      x: Math.min(BOARD_WIDTH - CARD_WIDTH - 80, 80 + c * CARD_WIDTH),
      y: Math.min(BOARD_HEIGHT - CARD_HEIGHT - 8, 40 + r * CARD_HEIGHT),
    })
    fill += 1
  }

  placements.sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x)
  return placements.slice(0, count)
}

/**
 * 随机分层布局。
 * 保证：场上每种图案张数均为 3 的倍数，因此理论上可完全消除。
 */
export function createInitialState(rng: () => number = Math.random): TileMatchState {
  for (let attempt = 0; attempt < 8; attempt++) {
    const targetCards = TARGET_CARD_BASE + Math.floor(rng() * 3) * TARGET_CARD_STEP
    const useCount = targetCards - (targetCards % MATCH_COUNT)
    if (useCount < MATCH_COUNT) continue

    const placements = buildSheepPlacements(useCount, rng)
    if (placements.length < useCount) continue

    const patternIds = buildPatternBag(useCount, rng)
    if (patternIds.length !== useCount) continue
    shuffleInPlace(patternIds, rng)

    const cards: BoardCard[] = []
    for (let i = 0; i < patternIds.length; i++) {
      const pos = placements[i]
      cards.push({
        id: `c${i}`,
        pattern: patternIds[i],
        x: Math.max(2, Math.min(pos.x, BOARD_WIDTH - CARD_WIDTH - 2)),
        y: Math.max(2, Math.min(pos.y, BOARD_HEIGHT - CARD_HEIGHT - 2)),
        layer: pos.layer,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        status: 'board',
      })
    }

    if (!assertPatternMultiples(cards)) continue

    return {
      cards,
      slot: [],
      status: 'playing',
      undoStack: [],
      shuffleLeft: DEFAULT_SHUFFLE,
      undoLeft: DEFAULT_UNDO,
      clearedGroups: 0,
      remaining: countRemaining(cards),
    }
  }

  // 极端兜底：固定 108 张（12 种 × 9 张）
  const fallbackCount = TARGET_CARD_BASE
  const placements = buildSheepPlacements(fallbackCount, rng)
  const cards: BoardCard[] = []
  for (let i = 0; i < fallbackCount; i++) {
    const pos = placements[i] ?? {
      layer: 0,
      x: (i % 10) * (CARD_WIDTH * 0.56) + 4,
      y: Math.floor(i / 10) * (CARD_HEIGHT * 0.52) + 4,
    }
    cards.push({
      id: `c${i}`,
      pattern: PATTERNS[Math.floor(i / 9) % PATTERNS.length].id,
      x: Math.max(2, Math.min(pos.x, BOARD_WIDTH - CARD_WIDTH - 2)),
      y: Math.max(2, Math.min(pos.y, BOARD_HEIGHT - CARD_HEIGHT - 2)),
      layer: pos.layer,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      status: 'board',
    })
  }

  return {
    cards,
    slot: [],
    status: 'playing',
    undoStack: [],
    shuffleLeft: DEFAULT_SHUFFLE,
    undoLeft: DEFAULT_UNDO,
    clearedGroups: 0,
    remaining: countRemaining(cards),
  }
}

/** 槽位内同图案满 3 张则消除 */
function findMatchIndices(slotCards: BoardCard[]): number[] | null {
  const counts = new Map<PatternId, number[]>()
  for (let i = 0; i < slotCards.length; i++) {
    const p = slotCards[i].pattern
    const list = counts.get(p) ?? []
    list.push(i)
    counts.set(p, list)
    if (list.length >= MATCH_COUNT) {
      return list.slice(0, MATCH_COUNT)
    }
  }
  return null
}

export type PickResult =
  | { ok: true; state: TileMatchState; matchedIds: string[] | null }
  | { ok: false; reason: 'blocked' | 'full' | 'ended' | 'missing' }

/** 点击棋盘卡牌 → 放入槽位 */
export function pickCard(state: TileMatchState, cardId: string): PickResult {
  if (state.status !== 'playing') return { ok: false, reason: 'ended' }
  const card = state.cards.find((c) => c.id === cardId)
  if (!card || card.status !== 'board') return { ok: false, reason: 'missing' }
  if (isCardBlocked(card, state.cards)) return { ok: false, reason: 'blocked' }
  if (state.slot.length >= SLOT_CAPACITY) return { ok: false, reason: 'full' }

  const slotBefore = [...state.slot]
  const undo: UndoEntry = {
    cardId,
    boardSnapshot: { x: card.x, y: card.y, layer: card.layer },
    slotBefore,
  }

  const cards = state.cards.map((c) => (c.id === cardId ? { ...c, status: 'slot' as const } : c))
  const nextSlot = [...state.slot]
  let insertAt = nextSlot.length
  for (let i = nextSlot.length - 1; i >= 0; i--) {
    const sc = cards.find((c) => c.id === nextSlot[i])
    if (sc?.pattern === card.pattern) {
      insertAt = i + 1
      break
    }
  }
  nextSlot.splice(insertAt, 0, cardId)

  const slotCards = nextSlot.map((id) => cards.find((c) => c.id === id)).filter((c): c is BoardCard => c != null)

  const matchIdx = findMatchIndices(slotCards)
  let matchedIds: string[] | null = null
  let clearedGroups = state.clearedGroups
  const finalSlot = nextSlot
  const finalCards = cards

  if (matchIdx) {
    matchedIds = matchIdx.map((i) => slotCards[i].id)
    clearedGroups += 1
  }

  const remaining = countRemaining(finalCards)
  let status: GameStatus = state.status
  if (!matchedIds && finalSlot.length >= SLOT_CAPACITY) {
    status = 'lost'
  }

  return {
    ok: true,
    matchedIds,
    state: {
      ...state,
      cards: finalCards,
      slot: finalSlot,
      undoStack: [...state.undoStack, undo],
      clearedGroups,
      remaining,
      status,
    },
  }
}

/** 将指定卡牌标为 clearing（飞入槽位后再调用） */
export function markClearing(state: TileMatchState, matchedIds: string[]): TileMatchState {
  const matchSet = new Set(matchedIds)
  return {
    ...state,
    cards: state.cards.map((c) =>
      matchSet.has(c.id) && c.status === 'slot' ? { ...c, status: 'clearing' as const } : c,
    ),
  }
}

/** 消除动画结束后把 clearing → removed，并检查通关 */
export function finalizeClearing(state: TileMatchState, matchedIds: string[]): TileMatchState {
  const matchSet = new Set(matchedIds)
  const cards = state.cards.map((c) =>
    matchSet.has(c.id) && c.status === 'clearing' ? { ...c, status: 'removed' as const } : c,
  )
  const slot = state.slot.filter((id) => !matchSet.has(id))
  const remaining = countRemaining(cards)
  const anyActive = cards.some((c) => c.status === 'board' || c.status === 'slot' || c.status === 'clearing')

  return {
    ...state,
    cards,
    slot,
    remaining,
    status: anyActive ? state.status : 'won',
  }
}

export function undoLast(state: TileMatchState): TileMatchState | null {
  if (state.status !== 'playing') return null
  if (state.undoLeft <= 0 || state.undoStack.length === 0) return null
  if (state.cards.some((c) => c.status === 'clearing')) return null

  const stack = [...state.undoStack]
  const last = stack.pop()
  if (!last) return null
  if (!state.slot.includes(last.cardId)) return null

  const cards = state.cards.map((c) => {
    if (c.id !== last.cardId) return c
    return {
      ...c,
      status: 'board' as const,
      x: last.boardSnapshot.x,
      y: last.boardSnapshot.y,
      layer: last.boardSnapshot.layer,
    }
  })

  return {
    ...state,
    cards,
    slot: last.slotBefore,
    undoStack: stack,
    undoLeft: state.undoLeft - 1,
    remaining: countRemaining(cards),
  }
}

/** 洗牌：只重排棋盘上图案位置，不改变各图案全局数量 */
export function shuffleBoard(state: TileMatchState, rng: () => number = Math.random): TileMatchState | null {
  if (state.status !== 'playing') return null
  if (state.shuffleLeft <= 0) return null
  if (state.cards.some((c) => c.status === 'clearing')) return null

  const boardCards = state.cards.filter((c) => c.status === 'board')
  if (boardCards.length < MATCH_COUNT) return null

  const patterns = boardCards.map((c) => c.pattern)
  shuffleInPlace(patterns, rng)

  const patternById = new Map<string, PatternId>()
  boardCards.forEach((c, i) => {
    patternById.set(c.id, patterns[i])
  })

  const cards = state.cards.map((c) => {
    const p = patternById.get(c.id)
    return p != null ? { ...c, pattern: p } : c
  })

  return {
    ...state,
    cards,
    shuffleLeft: state.shuffleLeft - 1,
    undoStack: [],
  }
}

export function getBoardSize(): { width: number; height: number } {
  return { width: BOARD_WIDTH, height: BOARD_HEIGHT }
}

export function getSlotCards(state: TileMatchState): BoardCard[] {
  return state.slot
    .map((id) => state.cards.find((c) => c.id === id))
    .filter((c): c is BoardCard => c != null && (c.status === 'slot' || c.status === 'clearing'))
}

export { BOARD_WIDTH, BOARD_HEIGHT }
