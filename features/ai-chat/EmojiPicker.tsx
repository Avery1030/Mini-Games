'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { winChrome, winChromeSunken } from '@/lib/winChrome'

/** 轻量表情库（按分类，避免依赖第三方包） */
export const EMOJI_GROUPS = [
  {
    id: 'face',
    items: ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😜', '🤗', '🤔', '😐', '😏', '😒', '🙄', '😔', '😢', '😭', '😤', '😡', '🤯', '😴', '😷', '🤒', '🤢', '🥳', '😎', '🤓', '🤖'],
  },
  {
    id: 'gesture',
    items: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '🤟', '🤘', '👌', '🫡', '🙏', '💪', '👀', '🧠', '💬', '💭', '💡'],
  },
  {
    id: 'object',
    items: ['❤️', '💔', '✨', '⭐', '🔥', '🎉', '🎊', '✅', '❌', '⚠️', '📌', '📎', '📁', '📝', '📚', '🎵', '🎮', '🖥️', '💻', '📱', '☕', '🍕', '🌈', '☀️', '🌙', '⚡'],
  },
] as const

export type EmojiPickerProps = {
  open: boolean
  onClose: () => void
  onPick: (emoji: string) => void
  className?: string
}

/**
 * Win95 风格表情面板：点击插入，点外部关闭。
 */
export function EmojiPicker({ open, onClose, onPick, className }: EmojiPickerProps) {
  const t = useTranslations('aiChat')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={rootRef}
      role='dialog'
      aria-label={t('emojiTitle')}
      className={cn(
        winChrome,
        'absolute bottom-full left-0 mb-1 z-20 w-[272px] max-h-[220px] overflow-hidden flex flex-col bg-chrome text-on-chrome',
        className,
      )}
    >
      <div className='px-2 py-1 text-[10px] font-bold border-b border-chrome-dark bg-chrome-hover/50'>
        {t('emojiTitle')}
      </div>
      <div className={cn(winChromeSunken, 'flex-1 min-h-0 overflow-y-auto p-1.5 space-y-2 bg-panel-inset')}>
        {EMOJI_GROUPS.map((group) => (
          <div key={group.id}>
            <div className='text-[10px] text-muted px-0.5 mb-1'>{t(`emojiGroup.${group.id}`)}</div>
            <div className='grid grid-cols-8 gap-0.5'>
              {group.items.map((emoji) => (
                <button
                  key={emoji}
                  type='button'
                  className='h-7 w-7 text-[16px] leading-none hover:bg-chrome-hover flex items-center justify-center'
                  title={emoji}
                  onClick={() => onPick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
