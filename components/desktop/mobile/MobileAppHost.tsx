'use client'

import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, X } from 'lucide-react'
import { useDesktopWindowApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { cn } from '@/lib/cn'
import type { DesktopAppView } from '@/config/desktop'

function pickForeground(apps: DesktopAppView[]): Nullable<DesktopAppView> {
  const visible = apps.filter((a) => a.isOpen && !a.minimized && a.app)
  if (visible.length === 0) return null
  const active = visible.find((a) => a.active)
  if (active) return active
  return visible.slice().sort((a, b) => b.zIndex - a.zIndex)[0] ?? null
}

/**
 * 手机全屏应用宿主：不复用 WindowsWindow 拖拽/缩放。
 * 返回主屏 = minimize；关闭 = close。
 */
export function MobileAppHost() {
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const t = useTranslations('mobile')
  const apps = useDesktopWindowApps()
  const hasHydrated = useDesktopHydrated()
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const closeWindow = useWindowStore((s) => s.closeWindow)

  const foreground = useMemo(
    () => (hasHydrated ? pickForeground(apps) : null),
    [apps, hasHydrated],
  )

  if (!foreground?.app) return null

  const App = foreground.app
  const title = resolveDesktopItemTitle(foreground, tApps, locale)

  return (
    <div
      className={cn(
        'fixed inset-0 z-[800] flex flex-col bg-[var(--window-face)] text-on-chrome',
      )}
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      data-mobile-app={foreground.id}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-1 border-b border-black/10 px-1 py-1.5',
          'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
        )}
      >
        <button
          type='button'
          className='flex size-9 items-center justify-center rounded-lg active:bg-white/15 touch-manipulation'
          aria-label={t('backHome')}
          onClick={() => minimizeWindow(foreground.id)}
        >
          <ChevronLeft className='size-5' strokeWidth={2.25} />
        </button>
        <h1 className='min-w-0 flex-1 truncate text-center text-sm font-semibold'>{title}</h1>
        <button
          type='button'
          className='flex size-9 items-center justify-center rounded-lg active:bg-white/15 touch-manipulation'
          aria-label={t('close')}
          onClick={() => closeWindow(foreground.id)}
        >
          <X className='size-4' strokeWidth={2.25} />
        </button>
      </header>

      <div className='min-h-0 flex-1 overflow-hidden overscroll-contain'>
        <App embedded />
      </div>
    </div>
  )
}
