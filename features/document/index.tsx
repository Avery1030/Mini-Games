'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel } from '@/components/ui'

export interface DocumentProps {
  embedded?: boolean
}

const DOC_IDS = ['welcome', 'desktop', 'apps', 'about'] as const
type DocId = (typeof DOC_IDS)[number]

export function DocumentApp({ embedded = false }: DocumentProps = {}) {
  const t = useTranslations('docs')
  const [activeId, setActiveId] = useState<DocId>('welcome')
  const title = t(`${activeId}.title`)
  const body = t.raw(`${activeId}.body`) as string[]

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex gap-2 p-2', embedded && 'p-3')}>
        <Panel padded={false} className='w-[128px] shrink-0 flex flex-col overflow-hidden'>
          <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark bg-chrome-hover/40'>
            {t('toc')}
          </div>
          <ul className='flex-1 overflow-y-auto p-1'>
            {DOC_IDS.map((id) => {
              const selected = id === activeId
              return (
                <li key={id}>
                  <button
                    type='button'
                    className={cn(
                      'w-full text-left px-2 py-1 text-[11px] truncate',
                      selected
                        ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                        : 'hover:bg-chrome-hover',
                    )}
                    onClick={() => setActiveId(id)}
                  >
                    {t(`${id}.title`)}
                  </button>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel inset className='flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'>
          <h2 className='text-base font-bold mb-2 shrink-0 border-b border-chrome-dark pb-1'>{title}</h2>
          <div className='flex-1 min-h-0 overflow-y-auto space-y-3 text-[12px] leading-relaxed text-on-chrome'>
            {(Array.isArray(body) ? body : []).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </Panel>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg'>
        {t('footer', { count: DOC_IDS.length, title })}
      </div>
    </div>
  )
}
