'use client'

import { Download, FolderOpen, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Panel } from '@/components/ui'
import type { AiChatSessionMeta } from './api'
import { cn } from '@/lib/cn'

export type SessionSidebarProps = {
  sessions: AiChatSessionMeta[]
  activeSessionId: Nullable<string>
  streaming: boolean
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onExport: () => void
  onImport: () => void
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  streaming,
  onNew,
  onSelect,
  onRename,
  onDelete,
  onExport,
  onImport,
}: SessionSidebarProps) {
  const t = useTranslations('aiChat')

  return (
    <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
      <div className='flex items-center justify-between gap-1 px-2 py-1.5 border-b border-chrome-dark max-md:py-2.5'>
        <span className='text-[11px] font-bold truncate max-md:text-[13px]'>{t('sessions')}</span>
        <Button size='icon-sm' className='max-md:size-9' title={t('newSession')} disabled={streaming} onClick={onNew}>
          <MessageSquarePlus size={12} className='max-md:size-4' />
        </Button>
      </div>
      <ul className='flex-1 overflow-y-auto p-1'>
        {sessions.map((s) => {
          const selected = s.id === activeSessionId
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-stretch gap-0.5',
                selected && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
              )}
            >
              <button
                type='button'
                className='min-w-0 flex-1 cursor-pointer text-left px-2 py-1.5 text-[11px] truncate touch-manipulation max-md:min-h-11 max-md:px-3 max-md:py-3 max-md:text-[13px]'
                disabled={streaming && !selected}
                onClick={() => onSelect(s.id)}
                title={s.title}
              >
                {s.title}
              </button>
              <button
                type='button'
                className={cn(
                  'shrink-0 cursor-pointer px-1.5 text-muted disabled:cursor-not-allowed touch-manipulation max-md:px-2.5',
                  selected && 'text-[var(--window-title-text)]/80',
                )}
                title={t('renameSession')}
                disabled={streaming}
                onClick={(e) => {
                  e.stopPropagation()
                  onRename(s.id)
                }}
              >
                <Pencil size={11} className='max-md:size-3.5' />
              </button>
              <button
                type='button'
                className={cn(
                  'shrink-0 cursor-pointer px-1.5 text-muted hover:text-[#c00] disabled:cursor-not-allowed touch-manipulation max-md:px-2.5',
                  selected && 'text-[var(--window-title-text)]/80',
                )}
                title={t('deleteSession')}
                disabled={streaming}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(s.id)
                }}
              >
                <Trash2 size={11} className='max-md:size-3.5' />
              </button>
            </li>
          )
        })}
      </ul>
      <div className='flex flex-wrap gap-1 p-1.5 border-t border-chrome-dark max-md:gap-1.5 max-md:p-2'>
        <Button size='sm' className='max-md:min-h-9' title={t('export')} disabled={!activeSessionId || streaming} onClick={onExport}>
          <Download size={11} />
          {t('export')}
        </Button>
        <Button size='sm' className='max-md:min-h-9' title={t('import')} disabled={streaming} onClick={onImport}>
          <FolderOpen size={11} />
          {t('import')}
        </Button>
      </div>
    </Panel>
  )
}
