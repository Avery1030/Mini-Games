'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { MasterDetail, Panel } from '@/components/ui'
import { useIsMobileViewport } from '@/hooks/desktop'
import { CHANGELOG_DATES, formatChangelogDate } from '@/content/changelog'

export interface DocumentProps {
  embedded?: boolean
}

const DOC_IDS = ['welcome', 'desktop', 'apps', 'changelog', 'about'] as const
type DocId = (typeof DOC_IDS)[number]

/** 文档里的更新摘要：只展示最近几条，完整列表见「日志」应用 */
const DOC_CHANGELOG_PREVIEW = 3

export function DocumentApp({ embedded = false }: DocumentProps = {}) {
  const t = useTranslations('docs')
  const tc = useTranslations('changelog')
  const tNav = useTranslations('mobile')
  const locale = useLocale()
  const isMobile = useIsMobileViewport()
  const [activeId, setActiveId] = useState<DocId>('welcome')
  /** 窄屏默认先看目录；桌面端忽略 */
  const [detailOpen, setDetailOpen] = useState(false)
  const title = t(`${activeId}.title`)
  const body = activeId === 'changelog' ? null : (t.raw(`${activeId}.body`) as string[])
  const previewIds = CHANGELOG_DATES.slice(0, DOC_CHANGELOG_PREVIEW)

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex p-2', embedded && 'p-3', isMobile && 'p-0')}>
        <MasterDetail
          defaultSize={128}
          minSize={96}
          maxSize={240}
          storageKey='split:document'
          isMobile={isMobile}
          backLabel={tNav('backToList')}
          detailOpen={detailOpen}
          onDetailOpenChange={setDetailOpen}
          detailTitle={title}
        >
          <Panel padded={false} className='h-full min-h-0 flex flex-col overflow-hidden'>
            <div className='px-2 py-1.5 text-[11px] font-bold border-b border-chrome-dark bg-chrome-hover/40 max-md:py-2.5 max-md:text-[13px]'>
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
                        'w-full text-left px-2 py-1 text-[11px] truncate touch-manipulation',
                        'max-md:min-h-11 max-md:px-3 max-md:py-3 max-md:text-[13px]',
                        selected
                          ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]'
                          : 'hover:bg-chrome-hover active:bg-chrome-hover',
                      )}
                      onClick={() => {
                        setActiveId(id)
                        setDetailOpen(true)
                      }}
                    >
                      {t(`${id}.title`)}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel inset className='h-full min-h-0 flex flex-col overflow-hidden max-md:!p-3'>
            <h2 className='text-base font-bold mb-2 shrink-0 border-b border-chrome-dark pb-1 max-md:text-lg'>
              {title}
            </h2>
            <div className='flex-1 min-h-0 overflow-y-auto space-y-3 text-[12px] leading-relaxed text-on-chrome max-md:text-[14px] max-md:space-y-3.5'>
              {activeId === 'changelog' ? (
                <>
                  {(t.raw('changelog.intro') as string[]).map((para, i) => (
                    <p key={`intro-${i}`}>{para}</p>
                  ))}
                  {previewIds.map((id) => (
                    <section key={id} className='space-y-1.5'>
                      <h3 className='font-bold text-[12px] max-md:text-[14px]'>
                        {tc(`${id}.title`)}
                        <span className='ml-2 font-normal text-[10px] text-muted max-md:text-[11px]'>
                          {formatChangelogDate(id, locale)}
                        </span>
                      </h3>
                      <ul className='list-disc pl-4 space-y-1'>
                        {(tc.raw(`${id}.items`) as string[]).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                  <p className='text-muted text-[11px] max-md:text-[12px]'>{t('changelog.more')}</p>
                </>
              ) : (
                (Array.isArray(body) ? body : []).map((para, i) => <p key={i}>{para}</p>)
              )}
            </div>
          </Panel>
        </MasterDetail>
      </div>

      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg max-md:py-2'>
        {t('footer', { count: DOC_IDS.length, title })}
      </div>
    </div>
  )
}
