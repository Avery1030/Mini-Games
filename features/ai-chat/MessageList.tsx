'use client'

import type { RefObject } from 'react'
import { Bot, Copy, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Panel } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { QUICK_PROMPTS } from './constants'
import type { UiMessage } from './types'
import { formatTime } from './utils'

export type MessageListProps = {
  messages: UiMessage[]
  historyLoading: boolean
  streaming: boolean
  listRef: RefObject<HTMLDivElement | null>
  onClear: () => void
  onCopy: (content: string) => void
  onQuickPrompt: (text: string) => void
}

/**
 * 消息列表：工具栏、空态快捷提问、气泡与流式光标。
 */
export function MessageList({
  messages,
  historyLoading,
  streaming,
  listRef,
  onClear,
  onCopy,
  onQuickPrompt,
}: MessageListProps) {
  const t = useTranslations('aiChat')
  const locale = useLocale()

  return (
    <>
      <div className='flex items-center justify-between gap-2 shrink-0'>
        <div className='min-w-0 flex items-center gap-1.5'>
          <Bot className='w-3.5 h-3.5 shrink-0 text-muted' aria-hidden />
          <p className='text-[11px] text-muted truncate'>{t('hint')}</p>
        </div>
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

      <Panel inset padded={false} className='flex-1 min-h-0 overflow-hidden flex flex-col'>
        <div ref={listRef} className='flex-1 min-h-0 overflow-y-auto p-2 space-y-2'>
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
            messages.map((m) => {
              const isLastAssistant =
                streaming && m.role === 'assistant' && m.id === messages[messages.length - 1]?.id
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  locale={locale}
                  isStreaming={isLastAssistant}
                  onCopy={onCopy}
                />
              )
            })
          )}
        </div>
      </Panel>
    </>
  )
}

type MessageBubbleProps = {
  message: UiMessage
  locale: string
  isStreaming: boolean
  onCopy: (content: string) => void
}

function MessageBubble({ message: m, locale, isStreaming, onCopy }: MessageBubbleProps) {
  const t = useTranslations('aiChat')

  return (
    <div
      className={cn(
        'group max-w-[92%] px-2 py-1.5 text-[12px] leading-relaxed border',
        m.role === 'user'
          ? 'ml-auto bg-[var(--window-title-active)] text-[var(--window-title-text)] border-chrome-dark'
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
          <button
            type='button'
            className={cn(
              'opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 cursor-pointer',
              m.role === 'user'
                ? 'text-[var(--window-title-text)]/80 hover:text-[var(--window-title-text)]'
                : 'text-muted hover:text-on-chrome',
            )}
            title={t('copy')}
            aria-label={t('copy')}
            onClick={() => onCopy(m.content)}
          >
            <Copy size={12} aria-hidden />
          </button>
        ) : null}
      </div>
      <div className='whitespace-pre-wrap break-words'>
        {m.content || (isStreaming ? t('thinking') : '')}
        {isStreaming ? (
          <span className='inline-block w-1.5 h-3 ml-0.5 align-middle bg-current animate-pulse' />
        ) : null}
      </div>
    </div>
  )
}
