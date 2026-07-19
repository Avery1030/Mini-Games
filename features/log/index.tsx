'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel } from '@/components/ui'

export interface LogProps {
  embedded?: boolean
}

/** 按时间倒序：最新在上 */
const LOG_IDS = ['2026-07-19', '2026-07-18', '2026-07-16', '2026-07-12'] as const
type LogId = (typeof LOG_IDS)[number]

export function LogApp({ embedded = false }: LogProps = {}) {
  const t = useTranslations('changelog')
  const [activeId, setActiveId] = useState<LogId>(LOG_IDS[0])
  const title = t(`${activeId}.title`)
  const date = t(`${activeId}.date`)
  const items = t.raw(`${activeId}.items`) as string[]

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex gap-2 p-2', embedded && 'p-3')}>
        <Panel padded={false} className='w-[148px] shrink-0 flex flex-col overflow-hidden'>
          <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark bg-chrome-hover/40'>
            {t('toc')}
          </div>
          <ul className='flex-1 overflow-y-auto p-1'>
            {LOG_IDS.map((id) => {
              const selected = id === activeId
              return (
                <li key={id}>
                  <button
                    type='button'
                    className={cn(
                      'w-full text-left px-2 py-1.5 text-[11px]',
                      selected
                        ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                        : 'hover:bg-chrome-hover',
                    )}
                    onClick={() => setActiveId(id)}
                  >
                    <div className='truncate font-medium'>{t(`${id}.title`)}</div>
                    <div
                      className={cn(
                        'truncate text-[10px] opacity-80',
                        selected ? 'text-[var(--window-title-text)]' : 'text-muted',
                      )}
                    >
                      {t(`${id}.date`)}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel inset className='flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'>
          <div className='shrink-0 border-b border-chrome-dark pb-1 mb-2'>
            <h2 className='text-base font-bold'>{title}</h2>
            <p className='text-[10px] text-muted mt-0.5'>{date}</p>
          </div>
          <ul className='flex-1 min-h-0 overflow-y-auto space-y-2 text-[12px] leading-relaxed list-disc pl-4'>
            {(Array.isArray(items) ? items : []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg'>
        {t('footer', { count: LOG_IDS.length, title })}
      </div>
    </div>
  )
}
