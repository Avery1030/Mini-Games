'use client'

import { useMemo, useState } from 'react'
import {
  type DesktopAppId,
  DESKTOP_APPS,
  DESKTOP_ICONS_LEFT,
  DESKTOP_ICONS_RIGHT,
  getDesktopIconDisplay,
  isDesktopAppIcon,
} from '../config/desktop'
import { MarioGame } from './MarioGame'
import { Minesweeper } from './Minesweeper'
import { WindowsWindow } from './WindowsWindow'
import type { DesktopAppConfig } from '../config/desktop'

function createDefaultState(): Record<DesktopAppId, boolean> {
  return Object.fromEntries(DESKTOP_APPS.map((app) => [app.id, false])) as Record<
    DesktopAppId,
    boolean
  >
}

/** 根据 contentType 渲染窗口内容 */
function AppWindowContent({ contentType }: { contentType: DesktopAppConfig['contentType'] }) {
  switch (contentType) {
    case 'minesweeper':
      return (
        <div className='bg-[#f7f7f1] -m-3 p-0 min-h-full'>
          <Minesweeper embedded />
        </div>
      )
    case 'mario':
      return (
        <div className='bg-[#2d2d2d] -m-3 p-0 min-h-full flex items-center justify-center'>
          <MarioGame embedded />
        </div>
      )
    case 'donation':
      return <p className='text-gray-300 text-sm'>弹窗内容区域，可自由替换。</p>
    default:
      return null
  }
}

/**
 * 老版 Windows 风格桌面主界面 - 图标与可打开应用由 config/desktop 配置驱动
 */
export function WindowsDesktop() {
  const [open, setOpen] = useState<Record<DesktopAppId, boolean>>(createDefaultState)
  const [minimized, setMinimized] = useState<Record<DesktopAppId, boolean>>(createDefaultState)
  const [activeWindowId, setActiveWindowId] = useState<DesktopAppId | null>(null)

  const hasVisibleWindow = useMemo(
    () => DESKTOP_APPS.some((app) => open[app.id] && !minimized[app.id]),
    [open, minimized]
  )

  const taskbarWindows = useMemo(
    () => DESKTOP_APPS.filter((app) => open[app.id]).map((app) => ({
      id: app.id,
      title: app.title,
      minimized: minimized[app.id],
    })),
    [open, minimized]
  )

  const setOpenById = (id: DesktopAppId, value: boolean) => {
    setOpen((prev) => ({ ...prev, [id]: value }))
  }

  const setMinimizedById = (id: DesktopAppId, value: boolean) => {
    setMinimized((prev) => ({ ...prev, [id]: value }))
  }

  const toggleMinimizedById = (id: DesktopAppId) => {
    setMinimized((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  /** 关闭某窗口时，将焦点移到另一个已打开窗口 */
  const getNextActiveId = (closedId: DesktopAppId): DesktopAppId | null => {
    const others = DESKTOP_APPS.filter((app) => app.id !== closedId && open[app.id])
    return others.length > 0 ? others[0].id : null
  }

  const handleIconClick = (appId: DesktopAppId) => {
    setOpenById(appId, true)
    setActiveWindowId(appId)
  }

  const socialIcons = ['✉️', '📤', '🐦', '▶️', '📰', '🔗']

  return (
    <div className='windows-desktop min-h-screen flex flex-col bg-[#2d6b6a]/90 select-none'>
      <div className='flex-1 flex relative overflow-hidden pt-2 pb-1'>
        {hasVisibleWindow && <div className='absolute inset-0 bg-black/20 z-[100]' aria-hidden />}

        <div className='flex gap-x-8 pl-6 pt-2'>
          <div className='flex flex-col gap-y-6'>
            {DESKTOP_ICONS_LEFT.map((item, i) => {
              const { label, icon } = getDesktopIconDisplay(item)
              const appId = isDesktopAppIcon(item) ? item.appId : undefined
              return (
                <DesktopIcon
                  key={i}
                  label={label}
                  icon={icon}
                  onClick={appId != null ? () => handleIconClick(appId) : undefined}
                />
              )
            })}
          </div>
          <div className='flex flex-col gap-y-6'>
            {DESKTOP_ICONS_RIGHT.map((item, i) => {
              const { label, icon } = getDesktopIconDisplay(item)
              const appId = isDesktopAppIcon(item) ? item.appId : undefined
              return (
                <DesktopIcon
                  key={i}
                  label={label}
                  icon={icon}
                  onClick={appId != null ? () => handleIconClick(appId) : undefined}
                />
              )
            })}
          </div>
        </div>

        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='flex items-end gap-6 -mr-32'>
            <div className='w-24 h-32 flex items-end justify-center bg-gray-300/30 rounded border-2 border-gray-400/50 pixel-border'>
              <span className='text-4xl mb-2'>👋</span>
            </div>
            <h1 className='windows-title text-6xl md:text-7xl lg:text-8xl font-bold text-amber-200/95 tracking-tighter drop-shadow-md'>
              DEMO
            </h1>
          </div>
        </div>

        {DESKTOP_APPS.map((app) =>
          open[app.id] ? (
            <WindowsWindow
              key={app.id}
              id={app.id}
              title={app.title}
              width={app.width}
              height={app.height}
              onClose={() => {
                setOpenById(app.id, false)
                if (activeWindowId === app.id) setActiveWindowId(getNextActiveId(app.id))
              }}
              onMinimize={() => setMinimizedById(app.id, true)}
              minimized={minimized[app.id]}
              isActive={activeWindowId === app.id}
              onFocus={() => setActiveWindowId(app.id)}
            >
              <AppWindowContent contentType={app.contentType} />
            </WindowsWindow>
          ) : null
        )}
      </div>

      <footer className='windows-taskbar relative z-[1100] h-12 flex items-center px-2 bg-[#c0c0c0] border-t-2 border-white shadow-[inset_1px_1px_0_#fff] min-h-[48px]'>
        <div className='flex items-center gap-1 h-full px-3 bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#a8a8a8] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white cursor-pointer'>
          <div className='w-6 h-6 flex items-center justify-center text-sm font-bold bg-amber-400/80 border border-amber-600/60'>
            D
          </div>
          <span className='text-sm font-bold text-black ml-1 hidden sm:inline'>DEMO</span>
        </div>

        <div className='flex items-center gap-1 min-w-0 ml-1'>
          {taskbarWindows.map((w) => (
            <button
              key={w.id}
              type='button'
              onClick={() => {
                setActiveWindowId(w.id)
                toggleMinimizedById(w.id)
              }}
              className={`px-3 py-1.5 text-sm font-medium shrink-0 max-w-[140px] truncate border-2 ${
                w.minimized
                  ? 'bg-[#c0c0c0] border-t-[#808080] border-l-[#808080] border-r-white border-b-white hover:bg-[#a8a8a8]'
                  : 'bg-[#c0c0c0] border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
              }`}
            >
              {w.title}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-2 ml-auto pl-2 shrink-0'>
          <div className='w-7 h-7 rounded-full bg-amber-300 border border-amber-500/80 flex items-center justify-center text-xs font-bold'>
            $
          </div>
          <div className='w-7 h-7 flex items-center justify-center border border-gray-600 bg-gray-300 rounded cursor-pointer hover:bg-gray-200'>
            <span className='text-sm'>⚙</span>
          </div>
          <button
            type='button'
            className='px-3 py-1.5 text-sm font-medium bg-[#c0c0c0] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#a8a8a8] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white cursor-pointer'
          >
            Settings
          </button>
          <div className='flex items-center gap-3 mr-2'>
            <select
              className='text-xs bg-[#c0c0c0] border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white px-2 py-1 cursor-pointer min-w-[72px]'
              defaultValue='en'
            >
              <option value='en'>English</option>
              <option value='zh'>中文</option>
            </select>
            <div className='flex items-center gap-1'>
              {socialIcons.map((icon, i) => (
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
}: {
  label: string
  icon: string
  onClick?: () => void
}) {
  return (
    <button
      type='button'
      className='desktop-icon group flex flex-col items-center w-16 gap-0.5 p-1 rounded hover:bg-white/30 active:bg-white/50 cursor-pointer border border-transparent hover:border-white/40'
      onClick={onClick}
    >
      <div className='w-12 h-12 flex items-center justify-center text-2xl bg-gray-200/80 border-2 border-gray-400 rounded pixel-icon shadow-sm'>
        {icon}
      </div>
      <span className='text-xs font-medium text-black text-center leading-tight max-w-full truncate drop-shadow-sm pixel-text'>
        {label}
      </span>
    </button>
  )
}
