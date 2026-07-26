'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Bot, Check, Copy, KeyRound, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Panel, toast } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { useCopyClipboard } from '@/hooks/useCopyClipboard'
import { QUICK_PROMPTS } from './constants'
import type { UiMessage } from './types'
import { formatTime } from './utils'

/** 距底部小于该值时视为「贴底」，新消息/流式增量继续自动滚到底 */
const STICK_BOTTOM_PX = 96
/** 距顶部小于该值时触发加载更旧一页 */
const LOAD_OLDER_PX = 48

export type MessageListProps = {
  messages: UiMessage[]
  historyLoading: boolean
  historyLoadingMore: boolean
  hasMoreHistory: boolean
  streaming: boolean
  onClear: () => void
  onDeleteMessage: (id: string) => void
  onLoadOlder: () => Promise<void>
  onQuickPrompt: (text: string) => void
  onChangeApiKey?: () => void
  changeApiKeyLabel?: string
}

/**
 * 消息列表：工具栏、空态快捷提问、虚拟滚动 + 上拉分页。
 */
export function MessageList({
  messages,
  historyLoading,
  historyLoadingMore,
  hasMoreHistory,
  streaming,
  onClear,
  onDeleteMessage,
  onLoadOlder,
  onQuickPrompt,
  onChangeApiKey,
  changeApiKeyLabel,
}: MessageListProps) {
  const t = useTranslations('aiChat')
  const locale = useLocale()
  const parentRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const prevCountRef = useRef(0)
  const prevFirstIdRef = useRef<string | undefined>(undefined)
  const pendingRestoreRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const loadOlderLockRef = useRef(false)

  const firstId = messages[0]?.id
  const lastId = messages[messages.length - 1]?.id
  const lastContent = messages[messages.length - 1]?.content
  const prevId = messages[messages.length - 2]?.id

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 4,
    gap: 8,
    getItemKey: (index) => messages[index]?.id ?? index,
  })

  useLayoutEffect(() => {
    const pending = pendingRestoreRef.current
    const el = parentRef.current
    if (!pending || !el) return
    el.scrollTop = pending.scrollTop + (el.scrollHeight - pending.scrollHeight)
    pendingRestoreRef.current = null
  }, [messages.length, firstId])

  useEffect(() => {
    const prevCount = prevCountRef.current
    const prevFirst = prevFirstIdRef.current
    const countIncreased = messages.length > prevCount
    const prepended = countIncreased && prevFirst != null && firstId != null && firstId !== prevFirst
    const appended = countIncreased && (prevFirst == null || firstId === prevFirst)

    prevCountRef.current = messages.length
    prevFirstIdRef.current = firstId

    if (prepended) return
    if (appended) stickToBottomRef.current = true
    if (!stickToBottomRef.current || messages.length === 0) return
    virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stick-to-bottom drivers only
  }, [messages.length, firstId, lastId, lastContent, streaming])

  const requestLoadOlder = async () => {
    if (!hasMoreHistory || historyLoadingMore || loadOlderLockRef.current) return
    loadOlderLockRef.current = true
    const el = parentRef.current
    if (el) {
      pendingRestoreRef.current = {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
      }
    }
    try {
      await onLoadOlder()
    } finally {
      loadOlderLockRef.current = false
    }
  }

  const onScroll = () => {
    const el = parentRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distance <= STICK_BOTTOM_PX
    if (el.scrollTop <= LOAD_OLDER_PX) {
      void requestLoadOlder()
    }
  }

  return (
    <>
      <div className='flex items-center justify-between gap-2 shrink-0'>
        <div className='min-w-0 flex items-center gap-1.5'>
          <Bot className='w-3.5 h-3.5 shrink-0 text-muted' aria-hidden />
          <p className='text-[11px] text-muted truncate'>{t('hint')}</p>
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
          {onChangeApiKey ? (
            <Button type='button' size='sm' onClick={onChangeApiKey} title={changeApiKeyLabel ?? t('apiKeyChange')}>
              <KeyRound size={12} aria-hidden />
              <span>{changeApiKeyLabel ?? t('apiKeyChange')}</span>
            </Button>
          ) : null}
          <Button
            type='button'
            size='sm'
            disabled={historyLoading || (messages.length === 0 && !streaming)}
            onClick={onClear}
            title={t('clear')}
          >
            <Trash2 size={12} aria-hidden />
            <span>{t('clear')}</span>
          </Button>
        </div>
      </div>

      <Panel inset padded={false} className='flex-1 min-h-0 overflow-hidden flex flex-col'>
        <div className='relative flex-1 min-h-0'>
          {historyLoadingMore ? (
            <div className='absolute top-0 inset-x-0 z-10 pointer-events-none px-2 py-1 text-center text-[10px] text-muted bg-panel-inset/80'>
              {t('historyLoadingMore')}
            </div>
          ) : null}
          <div
            ref={parentRef}
            onScroll={onScroll}
            className='h-full overflow-y-scroll p-2 [scrollbar-gutter:stable]'
          >
            {historyLoading ? (
              <p className='text-[11px] text-muted leading-relaxed px-1 py-2'>{t('historyLoading')}</p>
            ) : messages.length === 0 ? (
              <div className='px-1 py-2 space-y-2'>
                <p className='text-[11px] text-muted leading-relaxed'>{t('empty')}</p>
                <div className='flex flex-wrap gap-1'>
                  {QUICK_PROMPTS.map((key) => (
                    <button
                      key={key}
                      type='button'
                      disabled={streaming || historyLoading}
                      className={cn(
                        winChromeSunken,
                        'px-2 py-1 text-[11px] text-on-chrome hover:bg-chrome-hover disabled:opacity-50',
                      )}
                      onClick={() => onQuickPrompt(t(`quick.${key}`))}
                    >
                      {t(`quick.${key}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className='relative w-full' style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((row) => {
                  const m = messages[row.index]
                  if (!m) return null
                  const isLastAssistant = streaming && m.role === 'assistant' && m.id === lastId
                  const isActiveTurn = streaming && (m.id === lastId || m.id === prevId)
                  return (
                    <div
                      key={row.key}
                      data-index={row.index}
                      ref={virtualizer.measureElement}
                      className='absolute top-0 left-0 w-full'
                      style={{ transform: `translateY(${row.start}px)` }}
                    >
                      <MessageBubble
                        message={m}
                        locale={locale}
                        isStreaming={isLastAssistant}
                        canDelete={!isActiveTurn}
                        onDelete={() => onDeleteMessage(m.id)}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Panel>
    </>
  )
}

type MessageBubbleProps = {
  message: UiMessage
  locale: string
  isStreaming: boolean
  canDelete: boolean
  onDelete: () => void
}

function MessageBubble({ message: m, locale, isStreaming, canDelete, onDelete }: MessageBubbleProps) {
  const t = useTranslations('aiChat')
  const { isCopied, copy } = useCopyClipboard()

  const handleCopy = async () => {
    const ok = await copy(m.content)
    if (!ok) toast.error(t('copyFail'))
  }

  return (
    <div
      className={cn(
        'group max-w-[92%] px-2 py-1.5 text-[12px] leading-relaxed border',
        m.role === 'user'
          ? 'ml-auto bg-[var(--window-btn-hover)]/70 text-[var(--window-title-text)] border-chrome-dark'
          : 'mr-auto bg-chrome text-on-chrome border-chrome-dark',
      )}
    >
      <div className='flex items-center justify-between gap-2 mb-0.5'>
        <div
          className={cn(
            'text-[10px] font-bold opacity-80',
            m.role === 'user' ? 'text-[var(--window-title-text)]' : 'text-muted',
          )}
        >
          {m.role === 'user' ? t('you') : t('assistant')}
          <span className='ml-1.5 font-normal opacity-70'>{formatTime(m.createdAt, locale)}</span>
        </div>
        {m.content ? (
          <div className='flex items-center gap-0.5 shrink-0'>
            <button
              type='button'
              className={cn(
                'opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 cursor-pointer',
                isCopied && 'opacity-100',
                m.role === 'user'
                  ? 'text-[var(--window-title-text)]/80 hover:text-[var(--window-title-text)]'
                  : 'text-muted hover:text-on-chrome',
              )}
              title={isCopied ? t('copied') : t('copy')}
              aria-label={isCopied ? t('copied') : t('copy')}
              onClick={() => void handleCopy()}
            >
              {isCopied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
            </button>
            {canDelete ? (
              <button
                type='button'
                className={cn(
                  'opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 cursor-pointer',
                  m.role === 'user'
                    ? 'text-[var(--window-title-text)]/80 hover:text-[var(--window-title-text)]'
                    : 'text-muted hover:text-on-chrome',
                )}
                title={t('delete')}
                aria-label={t('delete')}
                onClick={onDelete}
              >
                <Trash2 size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className='whitespace-pre-wrap break-words'>
        {m.content || (isStreaming ? t('thinking') : '')}
        {isStreaming ? <span className='inline-block w-1.5 h-3 ml-0.5 align-middle bg-current animate-pulse' /> : null}
      </div>
    </div>
  )
}
