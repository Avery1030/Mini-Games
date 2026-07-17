'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { WindowsWindow } from './WindowsWindow'
import { useTranslations } from 'next-intl'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { cn } from '@/utils/cn'
import { winChrome, winChromePressed } from '@/utils/winChrome'
import { useAppStore } from '@/store/app'
import type { DesktopAppId } from '@/config/desktop'
import {
  CELL_SIZE,
  DRAG_THRESHOLD,
  type DesktopCoordinate,
  coordinateToPosition,
  diffCoordinates,
  positionToCoordinate,
  previewPlacement,
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

type DragSession = {
  id: DesktopAppId
  pointerId: number
  startX: number
  startY: number
  /** 指针相对图标左上角（viewport） */
  offsetX: number
  offsetY: number
  moved: boolean
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
  const updateCoordinates = useAppStore((s) => s.updateCoordinates)

  const desktopRef = useRef<HTMLDivElement>(null)
  const appsRef = useRef(apps)
  appsRef.current = apps
  const sessionRef = useRef<DragSession | null>(null)

  const [draggingId, setDraggingId] = useState<DesktopAppId | null>(null)
  /** fixed 定位时的 viewport 坐标 */
  const [dragPixel, setDragPixel] = useState<{ left: number; top: number } | null>(null)
  const [previewCoords, setPreviewCoords] = useState<Map<DesktopAppId, DesktopCoordinate> | null>(null)

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

  const desktopLocalFromViewport = useCallback((viewportLeft: number, viewportTop: number) => {
    const desktop = desktopRef.current
    if (!desktop) return { left: viewportLeft, top: viewportTop }
    const rect = desktop.getBoundingClientRect()
    const style = getComputedStyle(desktop)
    const padL = parseFloat(style.paddingLeft) || 0
    const padT = parseFloat(style.paddingTop) || 0
    return {
      left: viewportLeft - rect.left - padL,
      top: viewportTop - rect.top - padT,
    }
  }, [])

  const updatePreviewFromIconViewport = useCallback(
    (id: DesktopAppId, viewportLeft: number, viewportTop: number) => {
      const local = desktopLocalFromViewport(viewportLeft, viewportTop)
      const target = positionToCoordinate(local.left, local.top)
      setPreviewCoords(previewPlacement(appsRef.current, id, target))
    },
    [desktopLocalFromViewport],
  )

  const endDrag = useCallback(
    (viewportLeft: number, viewportTop: number, commit: boolean) => {
      const session = sessionRef.current
      sessionRef.current = null
      if (!session) return

      if (!session.moved) {
        openWindow(session.id)
        setDraggingId(null)
        setDragPixel(null)
        setPreviewCoords(null)
        return
      }

      if (commit) {
        const local = desktopLocalFromViewport(viewportLeft, viewportTop)
        const target = positionToCoordinate(local.left, local.top)
        const next = previewPlacement(appsRef.current, session.id, target)
        const updates = diffCoordinates(appsRef.current, next)
        if (updates.length > 0) {
          updateCoordinates(updates)
        }
      }

      setDraggingId(null)
      setDragPixel(null)
      setPreviewCoords(null)
    },
    [desktopLocalFromViewport, openWindow, updateCoordinates],
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return

      const dx = e.clientX - session.startX
      const dy = e.clientY - session.startY

      if (!session.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        session.moved = true
        setDraggingId(session.id)
      }

      const left = e.clientX - session.offsetX
      const top = e.clientY - session.offsetY
      setDragPixel({ left, top })
      updatePreviewFromIconViewport(session.id, left, top)
    }

    const onUp = (e: PointerEvent) => {
      const session = sessionRef.current
      if (!session || e.pointerId !== session.pointerId) return
      const left = e.clientX - session.offsetX
      const top = e.clientY - session.offsetY
      endDrag(left, top, true)
    }

    const onCancel = () => {
      const session = sessionRef.current
      if (!session) return
      endDrag(0, 0, false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [endDrag, updatePreviewFromIconViewport])

  const handleIconPointerDown = useCallback((id: DesktopAppId, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()

    const iconRect = e.currentTarget.getBoundingClientRect()
    sessionRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - iconRect.left,
      offsetY: e.clientY - iconRect.top,
      moved: false,
    }
  }, [])

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
          className='relative h-full min-h-0 grid auto-rows-[80px] grid-cols-[repeat(auto-fill,80px)] gap-2 items-start content-start'
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
