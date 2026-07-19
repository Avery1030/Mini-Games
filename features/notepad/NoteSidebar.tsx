'use client'

import { FilePlus2, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Panel } from '@/components/ui'
import type { NoteMeta } from './types'

function formatUpdatedAt(ts: number, locale: string): string {
  try {
    return new Date(ts).toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export interface NoteSidebarProps {
  notes: NoteMeta[]
  activeId: string | null
  loading: boolean
  busy: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function NoteSidebar({
  notes,
  activeId,
  loading,
  busy,
  onSelect,
  onCreate,
  onDelete,
}: NoteSidebarProps) {
  const t = useTranslations('notepad')
  const locale = useLocale()

  return (
    <Panel padded={false} className='w-[168px] shrink-0 flex flex-col overflow-hidden'>
      <div className='px-2 py-1.5 flex items-center justify-between gap-1 border-b border-chrome-dark bg-chrome-hover/40'>
        <span className='text-[11px] font-bold truncate'>{t('notes')}</span>
        <Button
          size='icon-sm'
          aria-label={t('new')}
          title={t('new')}
          disabled={busy}
          onClick={onCreate}
        >
          <FilePlus2 size={12} />
        </Button>
      </div>

      <ul className='flex-1 min-h-0 overflow-y-auto p-1'>
        {loading && (
          <li className='px-2 py-3 text-[11px] text-muted text-center'>{t('loading')}</li>
        )}
        {!loading && notes.length === 0 && (
          <li className='px-2 py-3 text-[11px] text-muted text-center'>{t('empty')}</li>
        )}
        {notes.map((note) => {
          const selected = note.id === activeId
          return (
            <li key={note.id}>
              <div
                className={cn(
                  'group flex items-start gap-0.5 rounded-sm',
                  selected
                    ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                    : 'hover:bg-chrome-hover',
                )}
              >
                <button
                  type='button'
                  className='flex-1 min-w-0 text-left px-2 py-1.5'
                  onClick={() => onSelect(note.id)}
                >
                  <div className='truncate text-[11px] font-medium'>{note.title || t('untitled')}</div>
                  <div
                    className={cn(
                      'truncate text-[10px]',
                      selected ? 'opacity-80' : 'text-muted',
                    )}
                  >
                    {formatUpdatedAt(note.updatedAt, locale)}
                  </div>
                </button>
                <button
                  type='button'
                  className={cn(
                    'shrink-0 p-1 mt-1 mr-0.5 opacity-0 group-hover:opacity-100',
                    selected && 'opacity-70 hover:opacity-100',
                    busy && 'pointer-events-none opacity-40',
                  )}
                  aria-label={t('delete')}
                  title={t('delete')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(note.id)
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
