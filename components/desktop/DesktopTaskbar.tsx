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
import { Button } from '@/components/ui'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'

const TRAY_DECOR_ICONS = ['✉️', '📤', '🐦', '▶️', '📰', '🔗'] as const

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
