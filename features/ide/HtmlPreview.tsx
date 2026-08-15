'use client'

import { useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChromeSunken } from '@/lib/winChrome'
import { getHtmlPreviewWindow } from '@/lib/desktop/window/ideWindows'
import { subscribeDesktopRegistry } from '@/lib/desktop/window/registry'

type Props = {
  embedded?: boolean
  windowId: string
}

export function HtmlPreviewApp({ embedded = false, windowId }: Props) {
  const t = useTranslations('ide')
  useSyncExternalStore(subscribeDesktopRegistry, () => getHtmlPreviewWindow(windowId)?.revision ?? 0, () => 0)
  const win = getHtmlPreviewWindow(windowId)
  const html = win?.html ?? ''
  const revision = win?.revision ?? 0

  return (
    <div className={cn(embeddedAppShell(embedded, 'flex flex-col bg-chrome min-h-0 p-1.5 gap-1'))}>
      <p className='shrink-0 px-1 text-[10px] text-muted'>{t('previewLocalHint')}</p>
      <div className={cn(winChromeSunken, 'flex-1 min-h-0 bg-white')}>
        <iframe
          key={revision}
          title={t('previewTitle')}
          sandbox='allow-scripts allow-forms'
          referrerPolicy='no-referrer'
          frameBorder={0}
          srcDoc={html}
          className='h-full w-full bg-white border-0'
        />
      </div>
    </div>
  )
}
