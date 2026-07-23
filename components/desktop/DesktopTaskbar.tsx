'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { StartMenu } from './StartMenu'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { TaskbarClock } from './TaskbarClock'
import { TaskbarWindowButton } from './TaskbarWindowButton'
import { AveryMark } from './AveryMark'
import { cn } from '@/lib/cn'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'

/**
 * 任务栏：开始菜单、窗口按钮、托盘。自行订阅 store。
 */
export function DesktopTaskbar() {
  const t = useTranslations()
  const tApps = useTranslations('apps')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)
  const toggleMinimizeAllWindows = useWindowStore((s) => s.toggleMinimizeAllWindows)
  const [startMenuOpen, setStartMenuOpen] = useState(false)

  const taskbarWindows = useMemo(() => {
    if (!hasHydrated) return []
    return apps
      .filter((app) => app.isOpen)
      .slice()
      .sort((a, b) => a.openOrder - b.openOrder || a.zIndex - b.zIndex)
      .map((app) => ({
        id: app.id,
        title: resolveDesktopItemTitle(app, tApps),
        icon: app.icon,
        minimized: app.minimized,
        isActive: app.active,
      }))
  }, [apps, hasHydrated, tApps])

  return (
    <footer className='relative z-[9000] h-12 min-h-[48px] flex items-center px-2 bg-taskbar text-on-chrome border-t-2 border-taskbar-edge shadow-[inset_1px_1px_0_var(--taskbar-shadow)] overflow-visible'>
      <div className='relative h-4/5 flex items-center overflow-visible' data-start-menu-root>
        <button
          type='button'
          aria-haspopup='menu'
          aria-expanded={startMenuOpen}
          className={cn(
            startMenuOpen ? winChromePressed : winChrome,
            'flex items-center gap-1 h-full px-3 cursor-pointer',
          )}
          onClick={() => setStartMenuOpen((v) => !v)}
        >
          <AveryMark className='w-6 h-6 shrink-0' />
          <span className='text-sm font-bold ml-1 hidden sm:inline'>{t('index.home')}</span>
        </button>
        <StartMenu open={startMenuOpen} onClose={() => setStartMenuOpen(false)} onOpenApp={openWindow} />
      </div>

      <div className='flex items-center gap-1 min-w-0 ml-1 overflow-x-auto shrink'>
        {taskbarWindows.map((w) => (
          <TaskbarWindowButton
            key={w.id}
            id={w.id}
            title={w.title}
            icon={w.icon}
            pressed={w.isActive && !w.minimized}
            onClick={() => handleTaskbarClick(w.id)}
          />
        ))}
      </div>

      {/* 空白区双击 → 显示桌面 / 还原（不抢窗口按钮 / 托盘点击） */}
      <div
        className='flex-1 self-stretch min-w-2 cursor-default'
        role='presentation'
        aria-label={t('window.minimizeAllHint')}
        onDoubleClick={(e) => {
          e.preventDefault()
          toggleMinimizeAllWindows()
        }}
      />

      <div className='flex items-center gap-2 pl-2 shrink-0'>
        <div className='flex items-center gap-1.5 mr-1'>
          <ThemeSwitch />
          <LangSwitch />
          <a
            href='https://github.com/Avery1030/Mini-Windows-Desktop'
            target='_blank'
            rel='noopener noreferrer'
            aria-label='GitHub'
            title='GitHub'
            className={cn(winChrome, 'inline-flex items-center justify-center w-6 h-6 p-0 shrink-0 select-none')}
          >
            <svg aria-hidden='true' focusable='false' className='w-4 h-4' viewBox='0 0 24 24' fill='currentColor'>
              <path d='M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943'></path>
            </svg>
          </a>
          <TaskbarClock />
        </div>
      </div>
    </footer>
  )
}
