'use client'

import { FilePlus2, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Panel } from '@/components/ui'
import type { DrawingMeta } from './types'

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

export interface DrawingSidebarProps {
  drawings: DrawingMeta[]
  activeId: string | null
  loading: boolean
  busy: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

export function DrawingSidebar({
  drawings,
  activeId,
  loading,
  busy,
  onSelect,
  onCreate,
  onDelete,
}: DrawingSidebarProps) {
  const t = useTranslations('paint')
  const locale = useLocale()

  return (
    <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
      <div className='px-2 py-1.5 flex items-center justify-between gap-1 border-b border-chrome-dark bg-chrome-hover/40 max-md:py-2.5'>
        <span className='text-[11px] font-bold truncate max-md:text-[13px]'>{t('drawings')}</span>
        <Button
          size='icon-sm'
          className='max-md:size-9'
          aria-label={t('new')}
          title={t('new')}
          disabled={busy}
          onClick={onCreate}
        >
          <FilePlus2 size={12} className='max-md:size-4' />
        </Button>
      </div>

      <ul className='flex-1 min-h-0 overflow-y-auto p-1'>
        {loading && <li className='px-2 py-3 text-[11px] text-muted text-center max-md:text-[13px]'>{t('loading')}</li>}
        {!loading && drawings.length === 0 && (
          <li className='px-2 py-3 text-[11px] text-muted text-center max-md:text-[13px]'>{t('empty')}</li>
        )}
        {drawings.map((item) => {
          const selected = item.id === activeId
          return (
            <li key={item.id}>
              <div
                className={cn(
                  'group flex items-start gap-0.5 rounded-sm',
                  selected
                    ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                    : 'hover:bg-chrome-hover active:bg-chrome-hover',
                )}
              >
                <button
                  type='button'
                  className='flex-1 min-w-0 text-left px-2 py-1.5 touch-manipulation max-md:min-h-12 max-md:px-3 max-md:py-3 max-md:border-b max-md:border-chrome-dark'
                  onClick={() => onSelect(item.id)}
                >
                  <div className='truncate text-[11px] font-medium max-md:text-[13px]'>
                    {item.title || t('untitled')}
                  </div>
                  <div
                    className={cn('truncate text-[10px] max-md:text-[11px]', selected ? 'opacity-80' : 'text-muted')}
                  >
                    {formatUpdatedAt(item.updatedAt, locale)}
                  </div>
                </button>
                <button
                  type='button'
                  className={cn(
                    'shrink-0 p-1 mt-1 mr-0.5 opacity-0 group-hover:opacity-100 touch-manipulation max-md:opacity-70 max-md:p-2 max-md:mt-2',
                    selected && 'opacity-70 hover:opacity-100',
                    busy && 'pointer-events-none opacity-40',
                  )}
                  aria-label={t('delete')}
                  title={t('delete')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(item.id)
                  }}
                >
                  <Trash2 size={11} className='max-md:size-3.5' />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
