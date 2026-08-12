'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { Dices, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import {
  createInitialState,
  finalizeClearing,
  getBoardSize,
  getSlotCards,
  isCardBlocked,
  markClearing,
  pickCard,
  shuffleBoard,
  undoLast,
} from './game'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  SLOT_CAPACITY,
  getPattern,
  type BoardCard,
  type PatternId,
  type TileMatchState,
} from './types'

export interface TileMatchProps {
  embedded?: boolean
}

const CLEAR_MS = 320
const FLY_MS = 300

type FlyAnim = {
  id: string
  pattern: PatternId
  fromX: number
  fromY: number
  toX: number
  toY: number
  fromW: number
  fromH: number
  toW: number
  toH: number
}

function TileCardFace({
  card,
  clickable = false,
  blocked = false,
  clearing,
  hidden,
  onClick,
  className,
  style,
  emojiClassName = 'text-base',
}: {
  card: BoardCard
  /** 是否可交互（飞行中为 false，但不因此压暗） */
  clickable?: boolean
  /** 被上层遮挡才压暗 */
  blocked?: boolean
  clearing?: boolean
  /** 飞行中目标槽位占位隐藏 */
  hidden?: boolean
  onClick?: () => void
  className?: string
  style?: CSSProperties
  emojiClassName?: string
}) {
  const pattern = getPattern(card.pattern)
  return (
    <button
      type='button'
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        'absolute select-none rounded-sm border-2 shadow-[1px_1px_0_rgba(0,0,0,0.25)]',
        'border-t-white border-l-white border-r-[#808080] border-b-[#808080]',
        'flex flex-col items-center justify-center transition-[filter,transform] duration-150',
        blocked ? 'cursor-default brightness-[0.55] saturate-[0.65]' : clickable ? 'cursor-pointer' : 'cursor-default',
        clearing && 'opacity-0 scale-75 transition-all duration-300',
        hidden && 'opacity-0',
        className,
      )}
      style={{
        width: card.width,
        height: card.height,
        backgroundColor: pattern.color,
        ...style,
      }}
      aria-label={pattern.id}
    >
      <span className={cn('leading-none', emojiClassName)} aria-hidden>
        {pattern.emoji}
      </span>
    </button>
  )
}

function FlyingCard({ anim, moved }: { anim: FlyAnim; moved: boolean }) {
  const pattern = getPattern(anim.pattern)
  const x = moved ? anim.toX : anim.fromX
  const y = moved ? anim.toY : anim.fromY
  const w = moved ? anim.toW : anim.fromW
  const h = moved ? anim.toH : anim.fromH
  return (
    <div
      className='pointer-events-none absolute z-[200] rounded-sm border-2 shadow-md border-t-white border-l-white border-r-[#808080] border-b-[#808080] flex items-center justify-center'
      style={{
        width: w,
        height: h,
        backgroundColor: pattern.color,
        transform: `translate(${x}px, ${y}px)`,
        transition: moved
          ? `transform ${FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1), width ${FLY_MS}ms ease, height ${FLY_MS}ms ease`
          : 'none',
      }}
      aria-hidden
    >
      <span className='text-lg leading-none'>{pattern.emoji}</span>
    </div>
  )
}

/**
 * 格子消消：羊了个羊式分层卡牌消除（DOM + 状态，无 Canvas 引擎）。
 */
export function TileMatch({ embedded = false }: TileMatchProps = {}) {
  const t = useTranslations('tileMatch')
  const [state, setState] = useState<TileMatchState>(() => createInitialState())
  const [flying, setFlying] = useState<FlyAnim | null>(null)
  const [flyMoved, setFlyMoved] = useState(false)
  const [boardScale, setBoardScale] = useState(1)
  const [slotSize, setSlotSize] = useState({ w: CARD_WIDTH, h: CARD_HEIGHT })
  const clearTimerRef = useRef<number | null>(null)
  const flyTimerRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const boardHostRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const slotTrayRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])
  const boardScaleRef = useRef(1)
  const boardSize = useMemo(() => getBoardSize(), [])

  const clearTimers = useCallback(() => {
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
    if (flyTimerRef.current != null) {
      window.clearTimeout(flyTimerRef.current)
      flyTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  // 棋盘按可用区域等比放大，提高屏幕利用率
  useEffect(() => {
    const host = boardHostRef.current
    if (!host) return

    const update = () => {
      const pad = 8
      const availW = Math.max(0, host.clientWidth - pad)
      const availH = Math.max(0, host.clientHeight - pad)
      if (availW <= 0 || availH <= 0) return
      const next = Math.min(availW / boardSize.width, availH / boardSize.height)
      // 允许放大，也允许略缩小；下限避免过小
      const clamped = Math.max(0.75, Math.min(next, 2.4))
      if (Math.abs(clamped - boardScaleRef.current) < 0.001) return
      boardScaleRef.current = clamped
      setBoardScale(clamped)
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [boardSize.height, boardSize.width])

  useEffect(() => {
    const tray = slotTrayRef.current
    if (!tray) return

    const update = () => {
      const gap = 4
      const pad = 12
      const avail = Math.max(0, tray.clientWidth - pad)
      const cell = Math.floor((avail - gap * (SLOT_CAPACITY - 1)) / SLOT_CAPACITY)
      const w = Math.max(CARD_WIDTH, Math.min(cell, Math.round(CARD_WIDTH * 1.6)))
      const h = Math.round((w / CARD_WIDTH) * CARD_HEIGHT)
      setSlotSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(tray)
    return () => ro.disconnect()
  }, [])

  const restart = useCallback(() => {
    clearTimers()
    setFlying(null)
    setFlyMoved(false)
    setState(createInitialState())
  }, [clearTimers])

  const scheduleFinalize = useCallback((matchedIds: string[]) => {
    if (clearTimerRef.current != null) {
      window.clearTimeout(clearTimerRef.current)
    }
    setState((prev) => markClearing(prev, matchedIds))
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null
      setState((prev) => finalizeClearing(prev, matchedIds))
    }, CLEAR_MS)
  }, [])

  const onPick = useCallback(
    (cardId: string) => {
      if (state.status !== 'playing' || flying) return

      const card = state.cards.find((c) => c.id === cardId)
      if (!card || card.status !== 'board') return

      const result = pickCard(state, cardId)
      if (!result.ok) return

      const root = rootRef.current
      const board = boardRef.current
      const slotIndex = result.state.slot.indexOf(cardId)
      const slotEl = slotIndex >= 0 ? slotRefs.current[slotIndex] : null
      const scale = boardScaleRef.current

      if (root && board && slotEl) {
        const rootRect = root.getBoundingClientRect()
        const boardRect = board.getBoundingClientRect()
        const slotRect = slotEl.getBoundingClientRect()
        const anim: FlyAnim = {
          id: cardId,
          pattern: card.pattern,
          fromX: boardRect.left - rootRect.left + card.x * scale,
          fromY: boardRect.top - rootRect.top + card.y * scale,
          toX: slotRect.left - rootRect.left,
          toY: slotRect.top - rootRect.top,
          fromW: CARD_WIDTH * scale,
          fromH: CARD_HEIGHT * scale,
          toW: slotRect.width,
          toH: slotRect.height,
        }
        setFlying(anim)
        setFlyMoved(false)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setFlyMoved(true))
        })
        flyTimerRef.current = window.setTimeout(() => {
          flyTimerRef.current = null
          setFlying(null)
          setFlyMoved(false)
          if (result.matchedIds) {
            scheduleFinalize(result.matchedIds)
          }
        }, FLY_MS)
      } else if (result.matchedIds) {
        scheduleFinalize(result.matchedIds)
      }

      setState(result.state)
    },
    [flying, scheduleFinalize, state],
  )

  const onUndo = useCallback(() => {
    if (state.status !== 'playing' || flying) return
    if (state.undoLeft <= 0 || state.undoStack.length === 0) return

    const last = state.undoStack[state.undoStack.length - 1]
    const card = state.cards.find((c) => c.id === last.cardId)
    if (!card || !state.slot.includes(last.cardId)) return

    const next = undoLast(state)
    if (!next) return

    const root = rootRef.current
    const board = boardRef.current
    const slotIndex = state.slot.indexOf(last.cardId)
    const slotEl = slotIndex >= 0 ? slotRefs.current[slotIndex] : null
    const scale = boardScaleRef.current

    if (root && board && slotEl) {
      const rootRect = root.getBoundingClientRect()
      const boardRect = board.getBoundingClientRect()
      const slotRect = slotEl.getBoundingClientRect()
      const anim: FlyAnim = {
        id: last.cardId,
        pattern: card.pattern,
        fromX: slotRect.left - rootRect.left,
        fromY: slotRect.top - rootRect.top,
        toX: boardRect.left - rootRect.left + last.boardSnapshot.x * scale,
        toY: boardRect.top - rootRect.top + last.boardSnapshot.y * scale,
        fromW: slotRect.width,
        fromH: slotRect.height,
        toW: CARD_WIDTH * scale,
        toH: CARD_HEIGHT * scale,
      }
      setFlying(anim)
      setFlyMoved(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFlyMoved(true))
      })
      flyTimerRef.current = window.setTimeout(() => {
        flyTimerRef.current = null
        setFlying(null)
        setFlyMoved(false)
      }, FLY_MS)
    }

    setState(next)
  }, [flying, state])

  const onShuffle = useCallback(() => {
    if (flying) return
    setState((prev) => shuffleBoard(prev) ?? prev)
  }, [flying])

  const boardCards = useMemo(
    () =>
      state.cards
        .filter((c) => c.status === 'board')
        .slice()
        .sort((a, b) => a.layer - b.layer || a.y - b.y || a.x - b.x),
    [state.cards],
  )

  const slotCards = useMemo(() => getSlotCards(state), [state])

  const canUndo = state.status === 'playing' && !flying && state.undoLeft > 0 && state.undoStack.length > 0
  const canShuffle = state.status === 'playing' && !flying && state.shuffleLeft > 0

  const boardVisualW = boardSize.width * boardScale
  const boardVisualH = boardSize.height * boardScale

  return (
    <div
      ref={rootRef}
      className={cn(
        embeddedAppShell(embedded, 'relative flex flex-col bg-[#c0c0c0] text-black min-h-0'),
        'overflow-hidden h-full',
      )}
    >
      {/* 状态栏 */}
      <div className={cn(winChromeSunken, 'mx-2 mt-2 px-2 py-1 flex items-center gap-2 sm:gap-3 text-xs shrink-0')}>
        <span className='font-bold truncate'>{t('title')}</span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('remaining')}: {state.remaining}
        </span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('cleared')}: {state.clearedGroups}
        </span>
        <button
          type='button'
          className={cn(winChrome, 'ml-auto h-6 px-2 inline-flex items-center gap-1 text-xs')}
          onClick={restart}
          aria-label={t('restart')}
        >
          <RotateCcw size={12} aria-hidden />
          {t('restart')}
        </button>
      </div>

      {/* 棋盘：按可用空间等比缩放 */}
      <div ref={boardHostRef} className='flex-1 min-h-0 flex items-center justify-center px-1 py-1 overflow-hidden'>
        <div className='relative shrink-0' style={{ width: boardVisualW, height: boardVisualH }}>
          <div
            ref={boardRef}
            className={cn(winChromeSunken, 'absolute left-0 top-0 bg-[#a8c48a] origin-top-left')}
            style={{
              width: boardSize.width,
              height: boardSize.height,
              transform: `scale(${boardScale})`,
            }}
            role='application'
            aria-label={t('boardLabel')}
          >
            {boardCards.map((card) => {
              const blocked = isCardBlocked(card, state.cards)
              const clickable = state.status === 'playing' && !flying && !blocked
              return (
                <TileCardFace
                  key={card.id}
                  card={card}
                  blocked={blocked}
                  clickable={clickable}
                  hidden={flying?.id === card.id}
                  onClick={() => onPick(card.id)}
                  emojiClassName='text-base'
                  style={{
                    left: card.x,
                    top: card.y,
                    zIndex: card.layer * 1000 + Math.round(card.y) * 2 + Math.round(card.x),
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* 道具 */}
      <div className='shrink-0 px-2 pb-1 flex items-center gap-2'>
        <button
          type='button'
          disabled={!canUndo}
          className={cn(
            canUndo ? winChrome : winChromePressed,
            'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-60',
          )}
          onClick={onUndo}
        >
          <Undo2 size={12} aria-hidden />
          {t('undo')} ({state.undoLeft})
        </button>
        <button
          type='button'
          disabled={!canShuffle}
          className={cn(
            canShuffle ? winChrome : winChromePressed,
            'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-60',
          )}
          onClick={onShuffle}
        >
          <Dices size={12} aria-hidden />
          {t('shuffle')} ({state.shuffleLeft})
        </button>
        <span className='ml-auto text-[11px] text-black/60 truncate max-w-[40%] hidden sm:inline'>{t('hint')}</span>
      </div>

      {/* 卡槽：宽度响应铺满 */}
      <div className='shrink-0 px-2 pb-2 overflow-hidden'>
        <div ref={slotTrayRef} className={cn(winChromeSunken, 'bg-[#a8a8a8] px-1.5 py-2 overflow-hidden')}>
          <div className='flex items-center justify-center gap-1' style={{ height: slotSize.h }}>
            {Array.from({ length: SLOT_CAPACITY }, (_, i) => {
              const card = slotCards[i]
              return (
                <div
                  key={`slot-${i}`}
                  ref={(el) => {
                    slotRefs.current[i] = el
                  }}
                  className={cn(
                    'relative shrink-0 grow-0 border border-dashed border-[#666] bg-[#bdbdbd]/80',
                    'rounded-sm box-border',
                  )}
                  style={{ width: slotSize.w, height: slotSize.h }}
                >
                  {card ? (
                    <TileCardFace
                      card={card}
                      clearing={card.status === 'clearing'}
                      hidden={flying?.id === card.id}
                      className='!absolute !inset-0'
                      emojiClassName={slotSize.w >= 40 ? 'text-xl' : 'text-base'}
                      style={{
                        left: 0,
                        top: 0,
                        width: slotSize.w,
                        height: slotSize.h,
                      }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
          <p className='text-center text-[10px] text-black/55 mt-1'>
            {t('slot')}: {state.slot.length}/{SLOT_CAPACITY}
          </p>
        </div>
      </div>

      {flying ? <FlyingCard anim={flying} moved={flyMoved} /> : null}

      {state.status === 'won' || state.status === 'lost' ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4'>
          <div className={cn(winChrome, 'bg-[#c0c0c0] px-5 py-4 min-w-[220px] text-center shadow-md')}>
            <p className={cn('text-base font-bold mb-1', state.status === 'won' ? 'text-green-800' : 'text-red-800')}>
              {state.status === 'won' ? t('won') : t('lost')}
            </p>
            <p className='text-xs text-black/70 mb-3'>{state.status === 'won' ? t('wonHint') : t('lostHint')}</p>
            <button type='button' className={cn(winChrome, 'px-3 py-1 text-sm')} onClick={restart}>
              {t('playAgain')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
