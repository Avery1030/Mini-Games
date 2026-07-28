'use client'

import { useTranslations } from 'next-intl'
import { useVisibleDesktopIcons } from '@/components/desktop/DesktopIconsLayer'
import { useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'
import { cn } from '@/lib/cn'
import type { DesktopAppId } from '@/config/desktop'

type MobileHomeGridProps = {
  /** Dock 已展示的 id，主屏可仍显示；此处仅用于视觉区分可选 */
  dockIds?: DesktopAppId[]
}

/**
 * 手机主屏 App 网格：按列表顺序排，不依赖桌面格点坐标。
 */
export function MobileHomeGrid({ dockIds = [] }: MobileHomeGridProps) {
  const tApps = useTranslations('apps')
  const t = useTranslations('mobile')
  const hasHydrated = useDesktopHydrated()
  const icons = useVisibleDesktopIcons()
  const openWindow = useWindowStore((s) => s.openWindow)
  const dockSet = new Set(dockIds)

  if (!hasHydrated) return null

  if (icons.length === 0) {
    return (
      <div className='flex flex-1 items-center justify-center px-6 text-center text-sm text-white/80'>
        {t('emptyHome')}
      </div>
    )
  }

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 pt-3'>
      <div className='grid grid-cols-4 gap-x-3 gap-y-5'>
        {icons.map((app) => {
          const Icon = app.icon
          const title = resolveDesktopItemTitle(app, tApps)
          const canOpen = Boolean(app.app)
          const inDock = dockSet.has(app.id)
          return (
            <button
              key={app.id}
              type='button'
              disabled={!canOpen}
              onClick={() => {
                if (canOpen) openWindow(app.id)
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl p-1.5',
                'active:scale-95 transition-transform touch-manipulation',
                !canOpen && 'opacity-40',
                inDock && 'opacity-90',
              )}
            >
              <span
                className={cn(
                  'flex size-14 items-center justify-center rounded-[1.15rem]',
                  'bg-white/92 text-[var(--window-title-active)] shadow-md shadow-black/25',
                  'ring-1 ring-white/40',
                )}
              >
                <Icon size={30} strokeWidth={1.75} absoluteStrokeWidth />
              </span>
              <span
                className='w-full truncate text-center text-[11px] font-medium leading-tight text-white'
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.55)' }}
              >
                {title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
