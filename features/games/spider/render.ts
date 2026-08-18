import { canPick } from './game'
import { COLS, DEAL_SIZE, type Card, type HintMove, type SpiderState, type Suit } from './types'

export type Rect = { x: number; y: number; w: number; h: number }

export type Layout = {
  cssW: number
  cssH: number
  cardW: number
  cardH: number
  faceDownDy: number
  faceUpDy: number
  colX: number[]
  tableauY: number
  stock: Rect
  foundations: Rect
}

export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const needW = Math.max(1, Math.round(cssW * dpr))
  const needH = Math.max(1, Math.round(cssH * dpr))
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  if (canvas.width !== needW || canvas.height !== needH) {
    canvas.width = needW
    canvas.height = needH
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export function computeLayout(cssW: number, cssH: number): Layout {
  const padX = 8
  const padT = 6
  const footer = 40
  const usableW = Math.max(220, cssW - padX * 2)
  const usableH = Math.max(180, cssH - padT - footer)
  const gap = Math.max(2, Math.min(8, usableW * 0.006))
  const cardW = Math.max(44, Math.min(100, (usableW - gap * 9) / 10))
  const cardH = Math.max(64, Math.min(cardW * 1.46, usableH * 0.52))
  const faceDownDy = Math.max(4, cardH * 0.11)
  const faceUpDy = Math.max(14, cardH * 0.26)
  const colX = Array.from({ length: COLS }, (_, i) => padX + i * (cardW + gap))
  return {
    cssW,
    cssH,
    cardW,
    cardH,
    faceDownDy,
    faceUpDy,
    colX,
    tableauY: padT,
    stock: {
      x: cssW - padX - cardW * 1.35,
      y: cssH - footer + 4,
      w: cardW * 1.35,
      h: Math.max(22, footer - 8),
    },
    foundations: {
      x: padX,
      y: cssH - footer + 4,
      w: cardW * 2.2,
      h: Math.max(22, footer - 8),
    },
  }
}

function pileYScale(col: readonly Card[], layout: Layout): number {
  if (col.length <= 1) return 1
  let extra = 0
  for (let i = 0; i < col.length - 1; i++) {
    extra += col[i]?.faceUp ? layout.faceUpDy : layout.faceDownDy
  }
  const maxH = Math.max(layout.cardH + 8, layout.cssH - layout.tableauY - 44)
  if (extra + layout.cardH <= maxH) return 1
  return Math.max(0.32, (maxH - layout.cardH) / extra)
}

export function columnCardY(col: readonly Card[], index: number, layout: Layout): number {
  const scale = pileYScale(col, layout)
  let y = layout.tableauY
  for (let i = 0; i < index; i++) {
    y += (col[i]?.faceUp ? layout.faceUpDy : layout.faceDownDy) * scale
  }
  return y
}

export function cardRect(col: readonly Card[], colIndex: number, cardIndex: number, layout: Layout): Rect {
  return {
    x: layout.colX[colIndex] ?? 0,
    y: columnCardY(col, cardIndex, layout),
    w: layout.cardW,
    h: layout.cardH,
  }
}

export function hitTestCard(
  state: SpiderState,
  layout: Layout,
  x: number,
  y: number,
  hiddenIds: ReadonlySet<number>,
): { col: number; index: number } | null {
  for (let col = 0; col < COLS; col++) {
    const pile = state.tableau[col] ?? []
    for (let i = pile.length - 1; i >= 0; i--) {
      const card = pile[i]
      if (!card || hiddenIds.has(card.id)) continue
      const r = cardRect(pile, col, i, layout)
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        return { col, index: i }
      }
    }
  }
  return null
}

export function hitTestStock(layout: Layout, x: number, y: number): boolean {
  const s = layout.stock
  return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
}

/** 点到某列牌面、空列占位或列宽范围内的空白，返回列号 */
export function hitTestColumn(state: SpiderState, layout: Layout, x: number, y: number): number | null {
  const cardHit = hitTestCard(state, layout, x, y, new Set())
  if (cardHit) return cardHit.col
  for (let col = 0; col < COLS; col++) {
    const x0 = layout.colX[col] ?? 0
    if (x < x0 || x > x0 + layout.cardW) continue
    const pile = state.tableau[col] ?? []
    const bottom =
      pile.length === 0 ? layout.tableauY + layout.cardH : cardRect(pile, col, pile.length - 1, layout).y + layout.cardH
    if (y >= layout.tableauY && y <= bottom + 10) return col
  }
  return null
}

export function dropColumnAt(layout: Layout, x: number): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < COLS; i++) {
    const cx = (layout.colX[i] ?? 0) + layout.cardW / 2
    const d = Math.abs(x - cx)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

const SUIT_GLYPH: Record<Suit, string> = {
  spades: '\u2660',
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
}

function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}

function suitColor(suit: Suit): string {
  return isRedSuit(suit) ? '#e31c23' : '#111111'
}

function drawSuit(ctx: CanvasRenderingContext2D, suit: Suit, cx: number, cy: number, s: number, color = suitColor(suit)) {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${Math.max(8, s * 1.78)}px "Times New Roman", "STIX Two Text", "Apple Symbols", "Segoe UI Symbol", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${SUIT_GLYPH[suit]}\uFE0E`, cx, cy + s * 0.06)
  ctx.restore()
}

function rankLabel(rank: number): string {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

export function drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 5)
  ctx.fillStyle = '#0d5c4c'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.strokeStyle = '#00382e'
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)

  ctx.save()
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3)
  ctx.clip()
  ctx.fillStyle = '#14856f'
  const step = Math.max(6, w * 0.16)
  for (let gy = y - step; gy < y + h + step; gy += step) {
    for (let gx = x - step; gx < x + w + step; gx += step) {
      ctx.beginPath()
      ctx.moveTo(gx, gy + step / 2)
      ctx.lineTo(gx + step / 2, gy)
      ctx.lineTo(gx + step, gy + step / 2)
      ctx.lineTo(gx + step / 2, gy + step)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()

  ctx.strokeStyle = '#7ee0c8'
  ctx.lineWidth = 1
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 2)
  ctx.stroke()

  drawSuit(ctx, 'spades', x + w / 2, y + h / 2, Math.min(w, h) * 0.22, '#062e26')
}

export type Highlight = false | 'hint' | 'active'

export function drawCardFace(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  highlight: Highlight = false,
) {
  roundRect(ctx, x, y, w, h, 5)
  ctx.fillStyle = highlight === 'active' ? '#fffceb' : '#fbfaf4'
  ctx.fill()
  ctx.lineWidth = highlight ? 2.6 : 1.25
  ctx.strokeStyle = highlight === 'active' ? '#ffe14a' : highlight === 'hint' ? '#f5c542' : '#2a2a2a'
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 3)
  ctx.stroke()

  const color = suitColor(card.suit)
  const label = rankLabel(card.rank)
  const fs = Math.max(9, w * 0.22)
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px Tahoma, "Times New Roman", serif`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(label, x + 4, y + 3)
  const cornerPip = Math.max(6, w * 0.14)
  drawSuit(ctx, card.suit, x + 4 + cornerPip * 0.55, y + fs + cornerPip * 0.7, cornerPip)

  ctx.save()
  ctx.translate(x + w - 4, y + h - 3)
  ctx.rotate(Math.PI)
  ctx.fillStyle = color
  ctx.font = `bold ${fs}px Tahoma, "Times New Roman", serif`
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(label, 0, 0)
  drawSuit(ctx, card.suit, cornerPip * 0.55, fs + cornerPip * 0.7, cornerPip)
  ctx.restore()

  drawSuit(ctx, card.suit, x + w / 2, y + h * 0.56, Math.min(w, h) * 0.28)
  ctx.textAlign = 'start'
  ctx.textBaseline = 'alphabetic'
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  highlight: Highlight = false,
  scaleX = 1,
  faceUp = card.faceUp,
) {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.scale(Math.max(0.02, scaleX), 1)
  ctx.translate(-(x + w / 2), -(y + h / 2))
  if (faceUp) drawCardFace(ctx, card, x, y, w, h, highlight)
  else drawCardBack(ctx, x, y, w, h)
  ctx.restore()
}

export type DrawExtras = {
  hiddenIds: ReadonlySet<number>
  ghost?: { cards: Card[]; x: number; y: number }
  flights?: { card: Card; x: number; y: number; scale?: number }[]
  hint?: HintMove | null
  active?: { col: number; index: number } | null
  flip?: { id: number; scaleX: number; showFace: boolean }
  stockPending?: number
}

export function drawSpider(ctx: CanvasRenderingContext2D, state: SpiderState, layout: Layout, extras: DrawExtras) {
  const { cssW, cssH, cardW, cardH } = layout
  ctx.clearRect(0, 0, cssW, cssH)
  ctx.fillStyle = '#0a6b3c'
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  for (let i = 0; i < cssW; i += 8) ctx.fillRect(i, 0, 4, cssH)

  const hintIds = new Set<number>()
  if (extras.hint) {
    const col = state.tableau[extras.hint.fromCol] ?? []
    for (let i = extras.hint.fromIndex; i < col.length; i++) {
      const id = col[i]?.id
      if (id != null) hintIds.add(id)
    }
  }
  const activeIds = new Set<number>()
  if (extras.active) {
    const col = state.tableau[extras.active.col] ?? []
    for (let i = extras.active.index; i < col.length; i++) {
      const id = col[i]?.id
      if (id != null) activeIds.add(id)
    }
  }

  for (let c = 0; c < COLS; c++) {
    const pile = state.tableau[c] ?? []
    const x = layout.colX[c] ?? 0
    if (pile.length === 0) {
      roundRect(ctx, x, layout.tableauY, cardW, cardH, 5)
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    for (let i = 0; i < pile.length; i++) {
      const card = pile[i]!
      if (extras.hiddenIds.has(card.id)) continue
      const r = cardRect(pile, c, i, layout)
      const flipping = extras.flip?.id === card.id
      const mark: Highlight = activeIds.has(card.id) ? 'active' : hintIds.has(card.id) ? 'hint' : false
      drawCard(
        ctx,
        card,
        r.x,
        r.y + (mark === 'active' ? -5 : 0),
        r.w,
        r.h,
        mark,
        flipping ? extras.flip!.scaleX : 1,
        flipping ? extras.flip!.showFace : card.faceUp,
      )
    }
  }

  if (extras.hint) {
    const dest = state.tableau[extras.hint.toCol] ?? []
    const slot = cardRect(dest, extras.hint.toCol, dest.length, layout)
    roundRect(ctx, slot.x - 2, slot.y - 2, slot.w + 4, slot.h + 4, 6)
    ctx.strokeStyle = '#f5c542'
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
  }

  const dealsLeft = Math.floor(Math.max(0, state.stock.length - (extras.stockPending ?? 0)) / DEAL_SIZE)
  const stockCardW = Math.min(cardW, 34)
  const stockCardH = Math.min(cardH, 48)
  const stockY = layout.stock.y - stockCardH + layout.stock.h
  if (dealsLeft === 0) {
    roundRect(ctx, layout.stock.x, stockY, stockCardW, stockCardH, 5)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  for (let i = 0; i < dealsLeft; i++) {
    drawCardBack(ctx, layout.stock.x + i * 7, stockY, stockCardW, stockCardH)
  }

  for (let i = 0; i < state.completed.length; i++) {
    const suit: Suit = state.completed[i]!
    const fx = layout.foundations.x + i * 10
    const dummy: Card = { id: -1 - i, suit, rank: 1, faceUp: true }
    drawCardFace(
      ctx,
      dummy,
      fx,
      layout.foundations.y - cardH + layout.foundations.h,
      Math.min(cardW, 34),
      Math.min(cardH, 48),
    )
  }

  if (extras.ghost) {
    const { cards, x, y } = extras.ghost
    ctx.globalAlpha = 0.92
    for (let i = 0; i < cards.length; i++) {
      drawCard(ctx, cards[i]!, x, y + i * layout.faceUpDy, cardW, cardH, 'active')
    }
    ctx.globalAlpha = 1
  }

  if (extras.flights) {
    for (const f of extras.flights) {
      const s = f.scale ?? 1
      drawCard(ctx, f.card, f.x, f.y, cardW * s, cardH * s, false, 1, true)
    }
  }
}

export function pickupFromHit(
  state: SpiderState,
  hit: { col: number; index: number },
): { col: number; index: number; cards: Card[] } | null {
  const pile = state.tableau[hit.col]
  if (!pile) return null
  if (!canPick(pile, hit.index)) return null
  return { col: hit.col, index: hit.index, cards: pile.slice(hit.index) }
}
