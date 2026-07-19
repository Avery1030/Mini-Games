'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { StartMenu } from './StartMenu'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { TaskbarClock } from './TaskbarClock'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'

const TRAY_DECOR_ICONS = ['✉️', '📤', '🐦', '▶️', '📰', '🔗'] as const

/**
 * 任务栏：开始菜单、窗口按钮、托盘。自行订阅 store。
 */
export function DesktopTaskbar() {
  const t = useTranslations()
  const td = useTranslations('desktop')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)
  const showTrayDecor = useSettingsStore((s) => s.showTrayDecor)
  const [startMenuOpen, setStartMenuOpen] = useState(false)

  const taskbarWindows = useMemo(() => {
    if (!hasHydrated) return []
    return apps
      .filter((app) => app.isOpen)
      .slice()
      .sort((a, b) => a.openOrder - b.openOrder || a.zIndex - b.zIndex)
      .map((app) => ({
        id: app.id,
        title: t(`apps.${app.id}`),
        icon: app.icon,
        minimized: app.minimized,
        isActive: app.active,
      }))
  }, [apps, hasHydrated, t])

  return (
    <footer className='relative z-[1100] h-12 min-h-[48px] flex items-center px-2 bg-taskbar text-on-chrome border-t-2 border-taskbar-edge shadow-[inset_1px_1px_0_var(--taskbar-shadow)]'>
      <div className='relative h-full flex items-center' data-start-menu-root>
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
          <div className='w-6 h-6 flex items-center justify-center text-sm font-bold border bg-accent border-accent-border text-black'>
            D
          </div>
          <span className='text-sm font-bold ml-1 hidden sm:inline'>{t('index.home')}</span>
        </button>
        <StartMenu open={startMenuOpen} onClose={() => setStartMenuOpen(false)} onOpenApp={openWindow} />
      </div>

      <div className='flex items-center gap-1 min-w-0 ml-1 overflow-x-auto'>
        {taskbarWindows.map((w) => {
          const Icon = w.icon
          const pressed = w.isActive && !w.minimized
          return (
            <Button
              key={w.id}
              size='md'
              variant={pressed ? 'pressed' : 'raised'}
              className='max-w-[160px] px-2 py-1.5 h-auto gap-1.5 justify-start'
              title={w.title}
              onClick={() => handleTaskbarClick(w.id)}
            >
              <Icon size={14} className='shrink-0' aria-hidden />
              <span className='truncate'>{w.title}</span>
            </Button>
          )
        })}
      </div>

      <div className='flex items-center gap-2 ml-auto pl-2 shrink-0'>
        <div className='w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold bg-accent border-accent-border text-black'>
          $
        </div>
        <ThemeSwitch />
        <Button size='md' className='px-3 py-1.5 h-auto' onClick={() => openWindow('settings')}>
          {td('settings')}
        </Button>
        <div className='flex items-center gap-2 mr-1'>
          <LangSwitch />
          {showTrayDecor && (
            <div className='flex items-center gap-1'>
              {TRAY_DECOR_ICONS.map((icon, i) => (
                <Button key={i} size='icon-sm'>
                  {icon}
                </Button>
              ))}
            </div>
          )}
          <TaskbarClock />
        </div>
      </div>
    </footer>
  )
}
