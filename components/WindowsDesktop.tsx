'use client'

import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { WindowsWindow } from './WindowsWindow'
import { useTranslations } from 'next-intl'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { cn } from '@/utils/cn'
import { useAppStore } from '@/store/app'

const CASCADE_OFFSET = 28

function getCascadedPosition(stackIndex: number, width: number, height: number) {
  if (typeof window === 'undefined') {
    return { x: 100 + stackIndex * CASCADE_OFFSET, y: 80 + stackIndex * CASCADE_OFFSET }
  }
  return {
    x: Math.max(20, (window.innerWidth - width) / 2 + stackIndex * CASCADE_OFFSET),
    y: Math.max(20, (window.innerHeight - height) / 2 - 40 + stackIndex * CASCADE_OFFSET),
  }
}

export function WindowsDesktop() {
  const t = useTranslations()
  const apps = useAppStore((s) => s.apps)
  const hasHydrated = useAppStore((s) => s._hasHydrated)
  const openWindow = useAppStore((s) => s.openWindow)
  const closeWindow = useAppStore((s) => s.closeWindow)
  const minimizeWindow = useAppStore((s) => s.minimizeWindow)
  const focusWindow = useAppStore((s) => s.focusWindow)
  const handleTaskbarClick = useAppStore((s) => s.handleTaskbarClick)

  const hasVisibleWindow = useMemo(
    () => hasHydrated && apps.some((app) => app.isOpen && !app.minimized),
    [hasHydrated, apps],
  )

  const openApps = useMemo(() => (hasHydrated ? apps.filter((app) => app.isOpen) : []), [hasHydrated, apps])

  const taskbarWindows = useMemo(
    () =>
      openApps.map((app) => ({
        id: app.id,
        title: t(`apps.${app.id}`),
        minimized: app.minimized,
        isActive: app.active,
      })),
    [openApps, t],
  )

  return (
    <div className='windows-desktop min-h-screen flex flex-col bg-[#2d6b6a]/90 select-none'>
      <div className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem] grid auto-rows-[80px] grid-cols-[repeat(auto-fill,80px)] gap-2'>
        {/* pointer-events-none：有窗口时仍可点击桌面图标打开其他窗口 */}
        {hasVisibleWindow && (
          <div className='absolute inset-0 bg-black/20 z-[100] pointer-events-none' aria-hidden />
        )}
        {apps.map((app) => {
          const [colIndex, rowIndex] = app.coordinate
          const Icon = app.icon

          return (
            <DesktopIcon
              key={app.id}
              label={t(`apps.${app.id}`)}
              icon={<Icon size={28} />}
              style={{ gridColumn: colIndex, gridRow: rowIndex }}
              onClick={() => openWindow(app.id)}
            />
          )
        })}

        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='flex items-end gap-6 -mr-32'>
            <div
              className='w-24 h-32 flex items-end justify-center bg-gray-300/30 rounded border-2 border-gray-400/50 
                shadow-[inset_1px_1px_0_rgba(255,255,255,0.5)]'
            >
              <span className='text-4xl mb-2'>👋</span>
            </div>
            <h1 className='windows-title text-6xl md:text-7xl lg:text-8xl font-bold text-amber-200/95 tracking-tighter drop-shadow-md'>
              {t('index.title')}
            </h1>
          </div>
        </div>

        {openApps.map((app) => {
          if (!app.app) return null
          const App = app.app
          const width = app.width ?? 400
          const height = app.height ?? 320
          // 按打开先后（zIndex）错开位置，避免多窗口完全重叠
          const cascadeIndex = openApps.filter((item) => item.zIndex < app.zIndex).length

          return (
            <WindowsWindow
              key={app.id}
              id={app.id}
              title={t(`apps.${app.id}`)}
              width={width}
              height={height}
              defaultPosition={getCascadedPosition(cascadeIndex, width, height)}
              onClose={() => closeWindow(app.id)}
              onMinimize={() => minimizeWindow(app.id)}
              minimized={app.minimized}
              isActive={app.active}
              zIndex={app.zIndex}
              onFocus={() => focusWindow(app.id)}
            >
              <App embedded />
            </WindowsWindow>
          )
        })}
      </div>

      <footer className='relative z-[1100] h-12 flex items-center px-2 bg-[#c0c0c0] border-t-2 border-white shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] min-h-[48px]'>
        <div className='flex items-center gap-1 h-full px-3 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#a8a8a8] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white cursor-pointer'>
          <div className='w-6 h-6 flex items-center justify-center text-sm font-bold bg-amber-400/80 border border-amber-600/60'>
            D
          </div>
          <span className='text-sm font-bold text-black ml-1 hidden sm:inline'>{t('index.home')}</span>
        </div>

        <div className='flex items-center gap-1 min-w-0 ml-1'>
          {taskbarWindows.map((w) => (
            <button
              key={w.id}
              type='button'
              className={cn('px-3 py-1.5 text-sm font-medium shrink-0 max-w-[140px] truncate border-2', {
                'bg-[#c0c0c0] border-t-[#808080] border-l-[#808080] border-r-white border-b-white hover:bg-[#a8a8a8]':
                  w.minimized,
                'bg-[#c0c0c0] border-t-white border-l-white border-r-[#808080] border-b-[#808080]':
                  !w.minimized && !w.isActive,
                'bg-[#a8a8a8] border-t-[#808080] border-l-[#808080] border-r-white border-b-white':
                  !w.minimized && w.isActive,
              })}
              onClick={() => handleTaskbarClick(w.id)}
            >
              {w.title}
            </button>
          ))}
        </div>
        <div className='flex items-center gap-2 ml-auto pl-2 shrink-0'>
          <div className='w-7 h-7 rounded-full bg-amber-300 border border-amber-500/80 flex items-center justify-center text-xs font-bold'>
            $
          </div>
          <ThemeSwitch />
          <button
            type='button'
            className='px-3 py-1.5 text-sm font-medium bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#a8a8a8] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white cursor-pointer'
          >
            Settings
          </button>
          <div className='flex items-center gap-3 mr-2'>
            <LangSwitch />
            <div className='flex items-center gap-1'>
              {['✉️', '📤', '🐦', '▶️', '📰', '🔗'].map((icon, i) => (
                <button
                  key={i}
                  type='button'
                  className='w-6 h-6 flex items-center justify-center text-xs bg-[#c0c0c0] border border-[#808080] hover:bg-[#a8a8a8] cursor-pointer'
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DesktopIcon({
  label,
  icon,
  onClick,
  style,
}: {
  label: string
  icon: ReactNode
  onClick?: () => void
  style?: CSSProperties
}) {
  return (
    <button
      type='button'
      className='group relative z-[101] flex flex-col items-center gap-3 p-1 rounded hover:bg-white/30 active:bg-white/50 cursor-pointer border border-transparent hover:border-white/40'
      onClick={onClick}
      style={style}
    >
      <div className='w-12 h-12 flex items-center justify-center bg-gray-200/80 border-2 border-gray-400 rounded pixel-icon shadow-sm'>
        {icon}
      </div>
      <span className='text-xs font-medium text-white text-center leading-tight max-w-full truncate drop-shadow-sm pixel-text'>
        {label}
      </span>
    </button>
  )
}
