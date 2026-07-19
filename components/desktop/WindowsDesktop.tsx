'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { WindowsWindow } from './WindowsWindow'
import { StartMenu } from './StartMenu'
import { useTranslations } from 'next-intl'
import LangSwitch from './LangSwitch'
import ThemeSwitch from './ThemeSwitch'
import { TaskbarClock } from './TaskbarClock'
import { cn } from '@/lib/cn'
import { Button, ContextMenu, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { useDesktopApps, useDesktopHydrated, useDesktopIconDrag } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { resolveDesktopBackgroundStyle, DESKTOP_BG_PLACEHOLDER_STYLE, CUSTOM_WALLPAPER_ID } from '@/config/wallpapers'
import { readWallpaperBoot } from '@/lib/wallpaper'
import { CELL_GAP, CELL_SIZE, coordinateToPosition, resolveCoordinate } from '@/lib/desktop'
import { isServer } from '@/lib/env'
import { scalePx } from '@/lib/uiScale'

const CASCADE_OFFSET = 28
const YIELD_TRANSITION = 'left 220ms ease, top 220ms ease'

const ICON_VIS = {
  sm: { box: 'w-8 h-8', px: 28, label: 'text-[10px]', stroke: 1.5 },
  md: { box: 'w-9 h-9', px: 32, label: 'text-[11px]', stroke: 1.6 },
  lg: { box: 'w-10 h-10', px: 36, label: 'text-xs', stroke: 1.75 },
} as const

/** Win95 桌面图标标签描边（未选中时） */
const ICON_LABEL_OUTLINE =
  '1px 0 0 var(--icon-label-outline), -1px 0 0 var(--icon-label-outline), 0 1px 0 var(--icon-label-outline), 0 -1px 0 var(--icon-label-outline), 1px 1px 0 var(--icon-label-outline)'

function getCascadedPosition(stackIndex: number, width: number, height: number) {
  if (isServer) {
    return { x: 100 + stackIndex * CASCADE_OFFSET, y: 80 + stackIndex * CASCADE_OFFSET }
  }
  return {
    x: Math.max(20, (window.innerWidth - width) / 2 + stackIndex * CASCADE_OFFSET),
    y: Math.max(20, (window.innerHeight - height) / 2 - 40 + stackIndex * CASCADE_OFFSET),
  }
}

export function WindowsDesktop() {
  const t = useTranslations()
  const td = useTranslations('desktop')
  const apps = useDesktopApps()
  const hasHydrated = useDesktopHydrated()
  const openWindow = useWindowStore((s) => s.openWindow)
  const closeWindow = useWindowStore((s) => s.closeWindow)
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow)
  const focusWindow = useWindowStore((s) => s.focusWindow)
  const handleTaskbarClick = useWindowStore((s) => s.handleTaskbarClick)
  const updateCoordinates = useDesktopStore((s) => s.updateCoordinates)
  const wallpaperId = useSettingsStore((s) => s.wallpaperId)
  const customWallpaperUrl = useSettingsStore((s) => s.customWallpaperUrl)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const showIconLabels = useSettingsStore((s) => s.showIconLabels)
  const iconSize = useSettingsStore((s) => s.iconSize)
  const uiScale = useSettingsStore((s) => s.uiScale)
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)
  const showTrayDecor = useSettingsStore((s) => s.showTrayDecor)

  /**
   * SSR 与首屏 hydrate 必须相同：禁止在 render 里读 localStorage。
   * 真实壁纸在 useLayoutEffect / settings 水合后再写入。
   */
  const [desktopBgStyle, setDesktopBgStyle] = useState<CSSProperties>(DESKTOP_BG_PLACEHOLDER_STYLE)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [startMenuOpen, setStartMenuOpen] = useState(false)

  useLayoutEffect(() => {
    const boot = readWallpaperBoot()
    const gallery = useSettingsStore.getState().wallpaperGallery
    if (boot?.wallpaperId === CUSTOM_WALLPAPER_ID && boot.customUrl) {
      const full = gallery.find((g) => g.url === boot.customUrl || g.thumbUrl === boot.customUrl)?.url ?? boot.customUrl
      setDesktopBgStyle(resolveDesktopBackgroundStyle(CUSTOM_WALLPAPER_ID, full))
      return
    }
    if (boot?.wallpaperId && boot.wallpaperId !== CUSTOM_WALLPAPER_ID) {
      setDesktopBgStyle(resolveDesktopBackgroundStyle(boot.wallpaperId, null))
    }
  }, [])

  useEffect(() => {
    if (!settingsHydrated) return
    const gallery = useSettingsStore.getState().wallpaperGallery
    const full =
      customWallpaperUrl &&
      (gallery.find((g) => g.url === customWallpaperUrl || g.thumbUrl === customWallpaperUrl)?.url ??
        customWallpaperUrl)
    setDesktopBgStyle(resolveDesktopBackgroundStyle(wallpaperId, full))
  }, [settingsHydrated, wallpaperId, customWallpaperUrl])

  const desktopRef = useRef<HTMLDivElement>(null)

  const desktopIcons = useMemo(() => {
    if (!hasHydrated) return []
    if (!hidePlaceholderIcons) return apps
    return apps.filter((app) => app.app != null)
  }, [apps, hasHydrated, hidePlaceholderIcons])

  const { draggingId, dragPixel, previewCoords, handleIconPointerDown } = useDesktopIconDrag({
    apps: desktopIcons,
    desktopRef,
    onOpen: openWindow,
    onCommit: updateCoordinates,
  })

  const iconVis = ICON_VIS[iconSize] ?? ICON_VIS.md
  const iconBoxPx = scalePx(iconVis.px, uiScale)

  const hasVisibleWindow = useMemo(
    () => hasHydrated && apps.some((app) => app.isOpen && !app.minimized),
    [hasHydrated, apps],
  )

  const openApps = useMemo(
    () =>
      hasHydrated
        ? apps
            .filter((app) => app.isOpen)
            .slice()
            .sort((a, b) => a.openOrder - b.openOrder || a.zIndex - b.zIndex)
        : [],
    [hasHydrated, apps],
  )

  const taskbarWindows = useMemo(
    () =>
      openApps.map((app) => ({
        id: app.id,
        title: t(`apps.${app.id}`),
        icon: app.icon,
        minimized: app.minimized,
        isActive: app.active,
      })),
    [openApps, t],
  )

  const closeContextMenu = () => setContextMenu(null)

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as Element | null
    // 窗口上的右键不弹出桌面菜单
    if (target?.closest?.('[data-window-id]')) return

    const iconEl = target?.closest?.('[data-desktop-icon]') as HTMLElement | null
    const iconId = (iconEl?.dataset.desktopIcon ?? null) as DesktopAppId | null
    const app = iconId ? desktopIcons.find((a) => a.id === iconId) : undefined
    const canOpen = Boolean(app?.app)

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'open',
          label: td('open'),
          disabled: !canOpen,
          onSelect: () => {
            if (iconId && canOpen) openWindow(iconId)
          },
        },
        {
          id: 'refresh',
          label: td('refresh'),
          onSelect: () => {
            window.location.reload()
          },
        },
      ],
    })
  }

  return (
    <div className='min-h-screen flex flex-col select-none font-pixel text-on-desktop' style={desktopBgStyle}>
      <div className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem]' onContextMenu={handleDesktopContextMenu}>
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
            desktopIcons.map((app) => {
              const coord = resolveCoordinate(app, previewCoords)
              const [col, row] = coord
              const { left, top } = coordinateToPosition(coord)
              const isDragging = draggingId === app.id
              const Icon = app.icon
              const yielding = draggingId != null && !isDragging

              return (
                <DesktopIcon
                  key={app.id}
                  appId={app.id}
                  label={t(`apps.${app.id}`)}
                  showLabel={showIconLabels}
                  iconBoxPx={iconBoxPx}
                  labelClass={iconVis.label}
                  icon={<Icon size={iconVis.px} strokeWidth={iconVis.stroke} absoluteStrokeWidth />}
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
            // 前台可见窗口：凹陷；最小化 / 非激活：凸起
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
                {['✉️', '📤', '🐦', '▶️', '📰', '🔗'].map((icon, i) => (
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

      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}

function DesktopIcon({
  appId,
  label,
  showLabel,
  iconBoxPx,
  labelClass,
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
  appId: DesktopAppId
  label: string
  showLabel: boolean
  iconBoxPx: number
  labelClass: string
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
      aria-label={label}
      data-desktop-icon={appId}
      className={cn(
        'group flex flex-col items-center gap-1 px-0.5 py-1 self-start outline-none',
        isDragging ? 'z-[200] opacity-85 cursor-grabbing' : 'z-[101] cursor-pointer',
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
      {/* 复古桌面：图标独立悬浮，无圆角底板 */}
      <div
        className={cn(
          'relative flex items-center justify-center text-icon-glyph pointer-events-none',
          '[image-rendering:pixelated]',
          'group-focus-visible:outline-1 group-focus-visible:outline-dashed group-focus-visible:outline-[var(--icon-focus-ring)] group-focus-visible:outline-offset-1',
          '[&_svg]:fill-current [&_svg]:fill-opacity-25',
        )}
        style={{
          width: iconBoxPx,
          height: iconBoxPx,
          filter: 'drop-shadow(1px 1px 0 var(--icon-glyph-shadow))',
        }}
      >
        {icon}
      </div>
      {showLabel && (
        <span
          title={label}
          className={cn(
            labelClass,
            'w-full min-w-0 px-0.5 text-center leading-tight font-pixel pointer-events-none',
            'text-on-desktop whitespace-nowrap overflow-hidden text-ellipsis',
            'group-hover:text-icon-select-fg group-hover:[text-shadow:none]',
            'group-focus-visible:text-icon-select-fg group-focus-visible:[text-shadow:none]',
            'group-active:text-icon-select-fg group-active:[text-shadow:none]',
          )}
          style={{ textShadow: ICON_LABEL_OUTLINE }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
