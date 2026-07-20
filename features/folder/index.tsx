'use client'

import { useTranslations } from 'next-intl'
import { FolderOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopItemsStore } from '@/store/desktopItems'

export type FolderAppProps = {
  embedded?: boolean
  folderTitle?: string
  folderId: DesktopAppId
}

/**
 * 文件夹窗口内容（占位）。
 */
export function FolderApp({ embedded = false, folderTitle, folderId }: FolderAppProps) {
  const t = useTranslations('folder')
  const folderRecord = useDesktopItemsStore((s) => s.folders.find((f) => f.id === folderId))
  const name = folderRecord?.title?.trim() || folderTitle?.trim() || t('untitled')

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'flex flex-col text-sm text-on-chrome bg-window font-pixel'),
        !embedded && 'p-4',
      )}
    >
      <div className={cn('flex-1 min-h-0 flex flex-col gap-2 overflow-hidden', embedded ? 'p-3' : 'p-2')}>
        <div className='shrink-0 flex items-center gap-2'>
          <FolderOpen size={18} strokeWidth={2} className='shrink-0 text-muted' aria-hidden />
          <div className='min-w-0'>
            <h2 className='text-base font-bold truncate'>{name}</h2>
            <p className='text-[11px] text-muted mt-0.5'>{t('hint')}</p>
          </div>
        </div>
        <Panel inset className='flex-1 min-h-0 flex items-center justify-center text-[11px] text-muted'>
          {t('empty')}
        </Panel>
      </div>
      <div className='shrink-0 px-3 py-1.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg truncate'>
        {t('status', { name })}
      </div>
    </div>
  )
}
