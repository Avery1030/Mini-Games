'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { cn } from '@/lib/cn'

type MobileRecentsProps = {
  open: boolean
  onClose: () => void
}

/**
 * 简易多任务：已开窗口卡片，点选还原/聚焦，可关闭。
 */
export function MobileRecents({ open, onClose }: MobileRecentsProps) {
  const tApps = useTranslations('apps')
  const t = useTranslations('mobile')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const closeWindow = useWindowStore((s) => s.closeWindow)

  const openApps = useMemo(() => {
    if (!hasHydrated) return []
    return apps
      .filter((a) => a.isOpen && a.app)
      .slice()
      .sort((a, b) => b.openOrder - a.openOrder || b.zIndex - a.zIndex)
  }, [apps, hasHydrated])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-[900] flex flex-col' role='dialog' aria-modal aria-label={t('recents')}>
      <button
        type='button'
        className='absolute inset-0 bg-black/55 backdrop-blur-sm'
        aria-label={t('closeRecents')}
        onClick={onClose}
      />

      <div
        className='relative z-10 mt-auto flex max-h-[78vh] flex-col rounded-t-3xl bg-[var(--window-face)] text-on-chrome shadow-2xl'
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className='flex items-center justify-between px-4 pb-2 pt-3'>
          <h2 className='text-base font-semibold'>{t('recents')}</h2>
          <button
            type='button'
            className='rounded-lg px-2 py-1 text-sm text-muted active:bg-black/5'
            onClick={onClose}
          >
            {t('done')}
          </button>
        </div>

        {openApps.length === 0 ? (
          <p className='px-4 py-8 text-center text-sm text-muted'>{t('noRecents')}</p>
        ) : (
          <ul className='min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2'>
            {openApps.map((app) => {
              const Icon = app.icon
              const title = resolveDesktopItemTitle(app, tApps)
              return (
                <li key={app.id}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border border-black/8 bg-white/80 px-3 py-2.5',
                      'dark:bg-white/5',
                    )}
                  >
                    <button
                      type='button'
                      className='flex min-w-0 flex-1 items-center gap-3 text-left touch-manipulation'
                      onClick={() => {
                        openWindow(app.id)
                        onClose()
                      }}
                    >
                      <span className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--window-title-active)]/10 text-[var(--window-title-active)]'>
                        <Icon size={24} strokeWidth={1.75} absoluteStrokeWidth />
                      </span>
                      <span className='min-w-0'>
                        <span className='block truncate text-sm font-medium'>{title}</span>
                        <span className='text-[11px] text-muted'>
                          {app.minimized ? t('minimized') : t('running')}
                        </span>
                      </span>
                    </button>
                    <button
                      type='button'
                      className='flex size-9 shrink-0 items-center justify-center rounded-full active:bg-black/8 touch-manipulation'
                      aria-label={t('close')}
                      onClick={() => closeWindow(app.id)}
                    >
                      <X className='size-4' strokeWidth={2} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
