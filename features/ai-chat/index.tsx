'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Bot, Copy, Smile, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Button, Panel, modal, toast } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { EmojiPicker } from './EmojiPicker'
import { clearChatHistory, fetchChatHistory, saveChatHistory } from './api'
import { streamChatCompletion, type ChatMessage } from './stream'

export type AiChatProps = {
  embedded?: boolean
}

type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

const SYSTEM_PROMPT =
  '你是「智聊」，运行在 Avery Mini OS 上的桌面助手。回答简洁、友好，可适度使用 emoji。使用用户的语言。'

const QUICK_PROMPTS = ['hello', 'summary', 'joke', 'code'] as const

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildRequestMessages(history: UiMessage[], nextUserText: string): ChatMessage[] {
  const prior = history
    .filter((m) => m.content.trim().length > 0)
    .map(({ role, content }) => ({ role, content }) satisfies ChatMessage)

  return [{ role: 'system', content: SYSTEM_PROMPT }, ...prior, { role: 'user', content: nextUserText }]
}

function formatTime(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function insertAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { next: string; caret: number } {
  const start = Math.max(0, selectionStart)
  const end = Math.max(start, selectionEnd)
  const next = value.slice(0, start) + insert + value.slice(end)
  return { next, caret: start + insert.length }
}

/**
 * 智聊：流式对话 + 表情；历史存服务端 .data/ai-chat/session.json。
 */
export function AiChatApp({ embedded = false }: AiChatProps = {}) {
  const t = useTranslations('aiChat')
  const locale = useLocale()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef(messages)
  const skipSaveRef = useRef(true)
  messagesRef.current = messages

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setHistoryLoading(true)
      try {
        const list = await fetchChatHistory()
        if (cancelled) return
        setMessages(
          list.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        )
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : t('historyLoadFail'))
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false)
          // 跳过载入后的第一次自动保存
          skipSaveRef.current = true
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  useEffect(() => {
    if (historyLoading) return
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    // 流式过程中不写盘，结束后再落盘
    if (streaming) return

    const toSave = messages.filter((m) => m.content.trim().length > 0)
    const timer = window.setTimeout(() => {
      void saveChatHistory(toSave).catch((err) => {
        toast.error(err instanceof Error ? err.message : t('historySaveFail'))
      })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [messages, streaming, historyLoading, t])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const clearChat = useCallback(async () => {
    if (messages.length === 0 && !streaming) return
    const ok = await modal.confirm({
      title: t('clearConfirmTitle'),
      message: t('clearConfirm'),
      confirmText: t('clear'),
      cancelText: t('cancel'),
    })
    if (!ok) return
    if (streaming) stop()
    setEmojiOpen(false)
    try {
      await clearChatHistory()
      skipSaveRef.current = true
      setMessages([])
      setInput('')
      toast.success(t('historyCleared'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('historyClearFail'))
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [messages.length, streaming, stop, t])

  const copyMessage = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content)
        toast.success(t('copied'))
      } catch {
        toast.error(t('copyFail'))
      }
    },
    [t],
  )

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = inputRef.current
      const start = el?.selectionStart ?? input.length
      const end = el?.selectionEnd ?? input.length
      const { next, caret } = insertAtCursor(input, start, end, emoji)
      setInput(next)
      requestAnimationFrame(() => {
        const ta = inputRef.current
        if (!ta) return
        ta.focus()
        ta.setSelectionRange(caret, caret)
      })
    },
    [input],
  )

  const sendText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || streaming) return

      const prior = messagesRef.current
      const requestMessages = buildRequestMessages(prior, text)
      const now = Date.now()

      const userMsg: UiMessage = { id: nextId('u'), role: 'user', content: text, createdAt: now }
      const assistantId = nextId('a')
      const assistantMsg: UiMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: now,
      }

      setEmojiOpen(false)
      setInput('')
      setMessages([...prior, userMsg, assistantMsg])
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await streamChatCompletion({
          messages: requestMessages,
          signal: controller.signal,
          onDelta: (piece) => {
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)))
          },
        })
      } catch (err) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId && !m.content ? { ...m, content: t('stopped') } : m)),
          )
        } else {
          const raw = err instanceof Error ? err.message : t('error')
          const lower = raw.toLowerCase()
          const message =
            lower.includes('insufficient') || lower.includes('balance') || lower.includes('余额')
              ? t('balanceInsufficient')
              : raw
          toast.error(message)
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId && !m.content ? { ...m, content: t('errorPrefix', { message }) } : m,
            ),
          )
        }
      } finally {
        abortRef.current = null
        setStreaming(false)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    },
    [streaming, t],
  )

  const send = useCallback(() => {
    void sendText(input)
  }, [input, sendText])

  const charCount = [...input].length
  const canSend = input.trim().length > 0 && !streaming

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className='flex-1 min-h-0 flex flex-col gap-2 p-2'>
        <div className='flex items-center justify-between gap-2 shrink-0'>
          <div className='min-w-0 flex items-center gap-1.5'>
            <Bot className='w-3.5 h-3.5 shrink-0 text-muted' aria-hidden />
            <p className='text-[11px] text-muted truncate'>{t('hint')}</p>
          </div>
          <Button
            type='button'
            size='sm'
            disabled={historyLoading || (messages.length === 0 && !streaming)}
            onClick={() => void clearChat()}
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
                      onClick={() => void sendText(t(`quick.${key}`))}
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
                  <div
                    key={m.id}
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
                          onClick={() => void copyMessage(m.content)}
                        >
                          <Copy size={12} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <div className='whitespace-pre-wrap break-words'>
                      {m.content || (isLastAssistant ? t('thinking') : '')}
                      {isLastAssistant ? (
                        <span className='inline-block w-1.5 h-3 ml-0.5 align-middle bg-current animate-pulse' />
                      ) : null}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Panel>

        <div className='shrink-0 flex flex-col gap-1.5 relative'>
          <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={insertEmoji} />
          <textarea
            ref={inputRef}
            value={input}
            disabled={streaming}
            rows={3}
            placeholder={t('placeholder')}
            className={cn(
              winChromeSunken,
              'w-full resize-none px-2 py-1.5 text-[12px] bg-window text-on-chrome',
              'outline-none disabled:opacity-60',
            )}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center gap-1.5 min-w-0'>
              <Button
                type='button'
                size='icon-sm'
                disabled={streaming}
                title={t('emoji')}
                aria-label={t('emoji')}
                aria-expanded={emojiOpen}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setEmojiOpen((v) => !v)}
              >
                <Smile size={14} aria-hidden />
              </Button>
              <span className='text-[10px] text-muted truncate'>
                {streaming ? t('streaming') : t('shortcut')}
                {charCount > 0 ? ` · ${t('chars', { count: charCount })}` : ''}
              </span>
            </div>
            <div className='flex items-center gap-1.5 shrink-0'>
              {streaming ? (
                <Button type='button' size='sm' onClick={stop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button type='button' size='sm' disabled={!canSend} onClick={() => void send()}>
                  {t('send')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
