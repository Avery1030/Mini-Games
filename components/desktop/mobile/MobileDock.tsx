'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { LayoutGrid } from 'lucide-react'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { getDesktopWindow, resolveDesktopItemTitle, type DesktopIconComponent } from '@/lib/desktop/window'
import { cn } from '@/lib/cn'
import type { DesktopAppId } from '@/config/desktop'
export const MOBILE_DOCK_APP_IDS: DesktopAppId[] = [
  'settings',
  'notepad',
  'aiChat',
  'recycleBin',
]

type DockItem = {
  id: DesktopAppId
  icon: DesktopIconComponent
  title: string
  isOpen: boolean
  minimized: boolean
}

type MobileDockProps = {
  onOpenRecents: () => void
  recentsOpen: boolean
}

/**
 * 底部 Dock：常用 App + 多任务。
 */
export function MobileDock({ onOpenRecents, recentsOpen }: MobileDockProps) {
  const tApps = useTranslations('apps')
  const t = useTranslations('mobile')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)

  const dockApps = useMemo((): DockItem[] => {
    if (!hasHydrated) return []
    const items: DockItem[] = []
    for (const id of MOBILE_DOCK_APP_IDS) {
      const desk = getDesktopWindow(id)
      if (!desk?.app) continue
      const fromList = apps.find((a) => a.id === id)
      items.push({
        id,
        icon: desk.icon,
        title: resolveDesktopItemTitle(
          fromList ?? { id, title: desk.title, kind: desk.kind },
          tApps,
        ),
        isOpen: fromList?.isOpen ?? false,
        minimized: fromList?.minimized ?? false,
      })
    }
    return items
  }, [apps, hasHydrated, tApps])

  const openCount = useMemo(
    () => (hasHydrated ? apps.filter((a) => a.isOpen).length : 0),
    [apps, hasHydrated],
  )

  return (
    <div
      className='shrink-0 px-3 pb-2 pt-1'
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className={cn(
          'mx-auto flex max-w-md items-center justify-around gap-1 rounded-[1.75rem] px-2 py-2.5',
          'bg-white/22 backdrop-blur-xl ring-1 ring-white/30 shadow-lg shadow-black/20',
        )}
      >
        {dockApps.map((app) => {
          const Icon = app.icon
          const running = app.isOpen && !app.minimized
          return (
            <button
              key={app.id}
              type='button'
              aria-label={app.title}
              onClick={() => {
                if (app.isOpen) handleTaskbarClick(app.id)
                else openWindow(app.id)
              }}
              className='relative flex size-14 flex-col items-center justify-center rounded-2xl active:scale-95 transition-transform touch-manipulation'
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-[1.05rem]',
                  'bg-white/95 text-[var(--window-title-active)] shadow-md shadow-black/20',
                )}
              >
                <Icon size={26} strokeWidth={1.75} absoluteStrokeWidth />
              </span>
              {running && (
                <span className='absolute bottom-0.5 size-1 rounded-full bg-white shadow' aria-hidden />
              )}
            </button>
          )
        })}

        <button
          type='button'
          aria-label={t('recents')}
          aria-pressed={recentsOpen}
          onClick={onOpenRecents}
          className='relative flex size-14 flex-col items-center justify-center rounded-2xl active:scale-95 transition-transform touch-manipulation'
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-[1.05rem]',
              'bg-white/95 text-[var(--window-title-active)] shadow-md shadow-black/20',
            )}
          >
            <LayoutGrid size={24} strokeWidth={1.85} absoluteStrokeWidth aria-hidden />
          </span>
          {openCount > 0 && (
            <span className='absolute bottom-0.5 size-1 rounded-full bg-white shadow' aria-hidden />
          )}
        </button>
      </div>
    </div>
  )
}
