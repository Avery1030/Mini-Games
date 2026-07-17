'use client'

import { useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { WindowsWindow } from './WindowsWindow'
import { useTranslations } from 'next-intl'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { cn } from '@/utils/cn'
import { winChrome, winChromePressed } from '@/utils/winChrome'
import { useDesktopApps, useDesktopHydrated } from '@/hooks/useDesktopApps'
import { useDesktopIconDrag } from '@/hooks/useDesktopIconDrag'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import {
  CELL_GAP,
  CELL_SIZE,
  coordinateToPosition,
  resolveCoordinate,
} from '@/utils/desktopLayout'

const CASCADE_OFFSET = 28
const YIELD_TRANSITION = 'left 220ms ease, top 220ms ease'

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
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)

  const desktopRef = useRef<HTMLDivElement>(null)
  const { draggingId, dragPixel, previewCoords, handleIconPointerDown } = useDesktopIconDrag({
    apps,
    desktopRef,
    onOpen: openWindow,
    onCommit: updateCoordinates,
  })

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
    <div
      className={cn(
        'min-h-screen flex flex-col select-none font-pixel text-on-desktop transition-[background,color] duration-300',
        'bg-[radial-gradient(ellipse_80%_50%_at_70%_20%,var(--desktop-bg-glow),transparent_55%),radial-gradient(ellipse_60%_40%_at_15%_80%,var(--desktop-pattern),transparent_50%),linear-gradient(165deg,var(--desktop-bg),var(--desktop-bg-deep))]',
      )}
    >
      <div className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem]'>
        {/* grid 放在无 padding 的内层，absolute 让位时与 grid 原点一致，避免拖拽瞬间「内边距消失」 */}
        <div
          ref={desktopRef}
          className='relative h-full min-h-0 grid items-start content-start'
          style={{
            gridAutoRows: CELL_SIZE,
            gridTemplateColumns: `repeat(auto-fill, ${CELL_SIZE}px)`,
            gap: CELL_GAP,
          }}
        >
          {hasHydrated &&
            apps.map((app) => {
              const coord = resolveCoordinate(app, previewCoords)
              const [col, row] = coord
              const { left, top } = coordinateToPosition(coord)
              const isDragging = draggingId === app.id
              const Icon = app.icon
              const yielding = draggingId != null && !isDragging

              return (
                <DesktopIcon
                  key={app.id}
                  label={t(`apps.${app.id}`)}
                  icon={<Icon size={28} />}
                  col={col}
                  row={row}
                  left={left}
                  top={top}
                  isDragging={isDragging}
                  yielding={yielding}
                  animateYield={yielding && previewCoords != null}
                  dragLeft={isDragging ? dragPixel?.left : undefined}
                  dragTop={isDragging ? dragPixel?.top : undefined}
                  onPointerDown={(e) => handleIconPointerDown(app.id, e)}
                />
              )
            })}
        </div>

        {hasVisibleWindow && (
          <div className='absolute inset-0 z-[100] bg-desktop-overlay pointer-events-none' aria-hidden />
        )}

        <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
          <div className='flex items-end gap-6 -mr-32'>
            <div className='w-24 h-32 flex items-end justify-center rounded border-2 bg-hero-plate border-hero-plate-border shadow-[inset_1px_1px_0_rgba(255,255,255,0.35)]'>
              <span className='text-4xl mb-2'>👋</span>
            </div>
            <h1
              className='text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-title [image-rendering:crisp-edges]'
              style={{ textShadow: '2px 2px 0 var(--title-shadow)' }}
            >
              {t('index.title')}
            </h1>
          </div>
        </div>

        {openApps.map((app) => {
          if (!app.app) return null
          const App = app.app
          const width = app.width ?? 400
          const height = app.height ?? 320
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

      <footer className='relative z-[1100] h-12 min-h-[48px] flex items-center px-2 bg-taskbar text-on-chrome border-t-2 border-taskbar-edge shadow-[inset_1px_1px_0_var(--taskbar-shadow)]'>
        <div className={cn(winChrome, 'flex items-center gap-1 h-full px-3 cursor-pointer')}>
          <div className='w-6 h-6 flex items-center justify-center text-sm font-bold border bg-accent border-accent-border text-black'>
            D
          </div>
          <span className='text-sm font-bold ml-1 hidden sm:inline'>{t('index.home')}</span>
        </div>

        <div className='flex items-center gap-1 min-w-0 ml-1'>
          {taskbarWindows.map((w) => (
            <button
              key={w.id}
              type='button'
              className={cn(
                'px-3 py-1.5 text-sm font-medium shrink-0 max-w-[140px] truncate',
                w.minimized || w.isActive ? winChromePressed : winChrome,
              )}
              onClick={() => handleTaskbarClick(w.id)}
            >
              {w.title}
            </button>
          ))}
        </div>
        <div className='flex items-center gap-2 ml-auto pl-2 shrink-0'>
          <div className='w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold bg-accent border-accent-border text-black'>
            $
          </div>
          <ThemeSwitch />
          <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm font-medium cursor-pointer')}>
            Settings
          </button>
          <div className='flex items-center gap-3 mr-2'>
            <LangSwitch />
            <div className='flex items-center gap-1'>
              {['✉️', '📤', '🐦', '▶️', '📰', '🔗'].map((icon, i) => (
                <button
                  key={i}
                  type='button'
                  className={cn(winChrome, 'w-6 h-6 flex items-center justify-center text-xs cursor-pointer')}
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
  col,
  row,
  left,
  top,
  isDragging,
  yielding,
  animateYield,
  dragLeft,
  dragTop,
  onPointerDown,
}: {
  label: string
  icon: ReactNode
  col: number
  row: number
  left: number
  top: number
  isDragging: boolean
  yielding: boolean
  animateYield: boolean
  dragLeft?: number
  dragTop?: number
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
}) {
  const layoutStyle: CSSProperties =
    isDragging && dragLeft != null && dragTop != null
      ? {
          position: 'fixed',
          left: dragLeft,
          top: dragTop,
          transition: 'opacity 120ms ease',
        }
      : yielding
        ? {
            position: 'absolute',
            left,
            top,
            transition: animateYield ? YIELD_TRANSITION : 'none',
          }
        : {
            gridColumn: col,
            gridRow: row,
            transition: 'none',
          }

  return (
    <div
      role='button'
      tabIndex={0}
      className={cn(
        'group flex flex-col items-center gap-3 p-1 rounded border border-transparent self-start',
        'hover:bg-icon-hover hover:border-icon-hover-border active:bg-icon-active',
        isDragging ? 'z-[200] opacity-90 cursor-grabbing' : 'z-[101] cursor-pointer',
        !isDragging && !yielding && 'relative',
      )}
      style={{
        width: CELL_SIZE,
        boxSizing: 'border-box',
        touchAction: 'none',
        userSelect: 'none',
        ...layoutStyle,
      }}
      onPointerDown={onPointerDown}
    >
      <div className='w-12 h-12 flex items-center justify-center border-2 rounded shadow-sm bg-icon border-icon-border text-on-chrome [image-rendering:crisp-edges] pointer-events-none'>
        {icon}
      </div>
      <span
        className='text-xs font-medium text-center leading-tight max-w-full truncate text-on-desktop font-pixel pointer-events-none'
        style={{ textShadow: '1px 1px 0 var(--icon-label-shadow)' }}
      >
        {label}
      </span>
    </div>
  )
}
