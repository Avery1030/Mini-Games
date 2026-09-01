'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { Panel } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import {
  getDesktopAppDefinitionsSnapshot,
  getDesktopWindow,
  prefetchApps,
  resolveDesktopItemTitle,
  subscribeDesktopRegistry,
} from '@/lib/desktop/window'
import { useIsMobileViewport } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { GAME_APP_IDS } from './ids'

/**
 * 内置「游戏」文件夹：列出小游戏，双击（触屏单击）打开；游戏本身不单独出现在桌面。
 */
export function GamesApp() {
  const t = useTranslations('games')
  const tApps = useTranslations('apps')
  const locale = useLocale()
  const isMobile = useIsMobileViewport()
  const openWindow = useWindowStore((s) => s.openWindow)
  const [selectedId, setSelectedId] = useState<Nullable<DesktopAppId>>(null)

  const definitions = useSyncExternalStore(
    subscribeDesktopRegistry,
    getDesktopAppDefinitionsSnapshot,
    getDesktopAppDefinitionsSnapshot,
  )

  const games = useMemo(() => {
    const byId = new Map(definitions.map((d) => [d.id, d]))
    return GAME_APP_IDS.map((id) => byId.get(id)).filter(
      (d): d is NonNullable<typeof d> => Boolean(d?.app),
    )
  }, [definitions])

  // 打开游戏夹后立刻预热列表内小游戏
  useEffect(() => {
    prefetchApps(GAME_APP_IDS)
  }, [])

  const launch = useCallback(
    (id: DesktopAppId) => {
      openWindow(id)
    },
    [openWindow],
  )

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-chrome text-on-chrome min-h-0'))}>
      <p className='shrink-0 px-2 py-1.5 text-[11px] text-muted border-b border-chrome-dark max-md:text-[12px]'>
        {t('hint')}
      </p>

      <Panel inset className='flex-1 min-h-0 m-2 flex flex-col p-0 overflow-hidden'>
        {games.length === 0 ? (
          <div className='flex-1 flex items-center justify-center text-[11px] text-muted'>{t('empty')}</div>
        ) : (
          <ul
            className='flex-1 min-h-0 overflow-y-auto bg-field text-on-field'
            role='listbox'
            aria-label={t('listLabel')}
          >
            {games.map((game) => {
              const selected = selectedId === game.id
              const Icon = game.icon
              const title = resolveDesktopItemTitle(game, tApps, locale)
              return (
                <li key={game.id}>
                  <button
                    type='button'
                    role='option'
                    aria-selected={selected}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 h-8 text-left text-xs touch-manipulation',
                      'max-md:min-h-11 max-md:h-auto max-md:py-2.5 max-md:text-[13px]',
                      'hover:bg-icon-select/30 focus-visible:outline-none focus-visible:bg-icon-select/40',
                      selected && 'bg-icon-select text-icon-select-fg',
                    )}
                    onPointerEnter={() => getDesktopWindow(game.id)?.prefetchApp()}
                    onClick={() => {
                      setSelectedId(game.id)
                      if (isMobile) launch(game.id)
                    }}
                    onDoubleClick={() => {
                      if (isMobile) return
                      setSelectedId(game.id)
                      launch(game.id)
                    }}
                  >
                    <Icon size={16} strokeWidth={1.75} className='shrink-0 max-md:size-[18px]' aria-hidden />
                    <span className='min-w-0 flex-1 truncate'>{title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <p className='shrink-0 px-2 pb-1.5 text-[10px] text-muted max-md:text-[11px]'>
        {t('status', { count: games.length })}
      </p>
    </div>
  )
}
