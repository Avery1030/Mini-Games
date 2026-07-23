'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { Smile } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { EmojiPicker } from './EmojiPicker'
import { insertAtCursor } from './utils'

export type ChatComposerProps = {
  inputRef: RefObject<HTMLTextAreaElement | null>
  streaming: boolean
  /** 会话被清空时递增，用于重置输入与表情面板 */
  sessionEpoch: number
  onSend: (text: string) => void
  onStop: () => void
}

/**
 * 输入区：表情、快捷键发送、停止/发送按钮。
 */
export function ChatComposer({
  inputRef,
  streaming,
  sessionEpoch,
  onSend,
  onStop,
}: ChatComposerProps) {
  const t = useTranslations('aiChat')
  const [input, setInput] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const skipEpochResetRef = useRef(true)

  useEffect(() => {
    if (skipEpochResetRef.current) {
      skipEpochResetRef.current = false
      return
    }
    setInput('')
    setEmojiOpen(false)
  }, [sessionEpoch])

  const charCount = [...input].length
  const canSend = input.trim().length > 0 && !streaming

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
    [input, inputRef],
  )

  const send = useCallback(() => {
    const text = input
    if (!text.trim() || streaming) return
    setEmojiOpen(false)
    setInput('')
    onSend(text)
  }, [input, onSend, streaming])

  return (
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
            send()
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
            <Button type='button' size='sm' onClick={onStop}>
              {t('stop')}
            </Button>
          ) : (
            <Button type='button' size='sm' disabled={!canSend} onClick={send}>
              {t('send')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
