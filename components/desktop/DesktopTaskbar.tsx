'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StartMenu } from './StartMenu'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { TaskbarClock } from './TaskbarClock'
import { TaskbarWindowButton } from './TaskbarWindowButton'
import { AveryMark } from './AveryMark'
import { cn } from '@/lib/cn'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { useDesktopApps, useDesktopHydrated, useTaskbarReorder } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'
import { resolveDesktopItemTitle } from '@/lib/desktop/window'

const SCROLL_STEP = 160

/**
 * 任务栏：开始菜单、窗口按钮（可拖拽排序、溢出箭头）、托盘。自行订阅 store。
 */
export function DesktopTaskbar() {
  const t = useTranslations()
  const tApps = useTranslations('apps')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)
  const reorderTaskbarWindows = useWindowStore((s) => s.reorderTaskbarWindows)
  const toggleMinimizeAllWindows = useWindowStore((s) => s.toggleMinimizeAllWindows)
  const [startMenuOpen, setStartMenuOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

  const byId = useMemo(() => new Map(taskbarWindows.map((w) => [w.id, w])), [taskbarWindows])

  const { displayOrder, draggingId, onPointerDown } = useTaskbarReorder({
    items: taskbarWindows,
    listRef,
    onReorder: reorderTaskbarWindows,
    onClick: handleTaskbarClick,
  })

  const updateScrollAffordance = useCallback(() => {
    const el = listRef.current
    if (!el) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    const max = scrollWidth - clientWidth
    const overflow = max > 1
    setCanScrollLeft(overflow && scrollLeft > 1)
    setCanScrollRight(overflow && scrollLeft < max - 1)
  }, [])

  useLayoutEffect(() => {
    updateScrollAffordance()
  }, [displayOrder, updateScrollAffordance])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    updateScrollAffordance()
    el.addEventListener('scroll', updateScrollAffordance, { passive: true })
    const ro = new ResizeObserver(() => updateScrollAffordance())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollAffordance)
      ro.disconnect()
    }
  }, [updateScrollAffordance])

  const scrollByDir = (dir: -1 | 1) => {
    const el = listRef.current
    if (!el) return
    el.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' })
  }

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

      <div className='flex items-center min-w-0 ml-1 shrink flex-1 max-w-full'>
        {canScrollLeft ? (
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-5 shrink-0 inline-flex items-center justify-center mr-0.5')}
            aria-label={t('window.taskbarScrollLeft')}
            onClick={() => scrollByDir(-1)}
          >
            <ChevronLeft size={14} strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}

        <div
          ref={listRef}
          className='taskbar-window-strip flex items-center gap-1 min-w-0 flex-1 overflow-x-auto overflow-y-hidden'
          aria-label={t('window.taskbarWindows')}
        >
          {displayOrder.map((id) => {
            const w = byId.get(id)
            if (!w) return null
            return (
              <TaskbarWindowButton
                key={w.id}
                id={w.id}
                title={w.title}
                icon={w.icon}
                pressed={w.isActive && !w.minimized}
                dragging={draggingId === w.id}
                onActivate={() => handleTaskbarClick(w.id)}
                onPointerDown={(e) => onPointerDown(w.id, e)}
              />
            )
          })}
        </div>

        {canScrollRight ? (
          <button
            type='button'
            className={cn(winChrome, 'h-7 w-5 shrink-0 inline-flex items-center justify-center ml-0.5')}
            aria-label={t('window.taskbarScrollRight')}
            onClick={() => scrollByDir(1)}
          >
            <ChevronRight size={14} strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}
      </div>

      <div
        className='self-stretch min-w-2 w-2 shrink-0 cursor-default'
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
