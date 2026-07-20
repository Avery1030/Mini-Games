'use client'

import { type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Checkbox, Input, Panel } from '@/components/ui'

export interface NoteEditorProps {
  title: string
  content: string
  wordWrap: boolean
  dirty: boolean
  saving: boolean
  disabled: boolean
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onWordWrapChange: (value: boolean) => void
  onSave: () => void
}

export function NoteEditor({
  title,
  content,
  wordWrap,
  dirty,
  saving,
  disabled,
  onTitleChange,
  onContentChange,
  onWordWrapChange,
  onSave,
}: NoteEditorProps) {
  const t = useTranslations('notepad')

  if (disabled) {
    return (
      <Panel inset className='h-full min-h-0 flex items-center justify-center'>
        <p className='text-[12px] text-muted px-4 text-center'>{t('selectOrCreate')}</p>
      </Panel>
    )
  }

  return (
    <Panel inset className='h-full min-h-0 flex flex-col overflow-hidden !p-2'>
      <div className='shrink-0 flex items-center gap-2 mb-2'>
        <Input
          value={title}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onTitleChange(e.target.value)}
          placeholder={t('titlePlaceholder')}
          size='md'
          tone='field'
          className='flex-1 font-bold'
          aria-label={t('title')}
        />
        <Button size='md' className='px-3 font-bold' loading={saving} disabled={!dirty || saving} onClick={onSave}>
          {t('save')}
        </Button>
      </div>

      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        spellCheck={false}
        className={cn(
          'flex-1 min-h-0 w-full resize-none font-pixel text-[12px] leading-relaxed',
          'bg-field text-on-chrome border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          'outline-none p-2',
          wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-auto',
        )}
        aria-label={t('content')}
      />

      <div className='shrink-0 mt-2 flex items-center justify-between gap-2'>
        <Checkbox
          checked={wordWrap}
          onChange={(e) => onWordWrapChange(e.target.checked)}
          label={t('wordWrap')}
        />
        <span className='text-[10px] text-muted tabular-nums'>
          {dirty ? t('unsaved') : t('saved')}
          {' · '}
          {t('chars', { count: content.length })}
        </span>
      </div>
    </Panel>
  )
}
