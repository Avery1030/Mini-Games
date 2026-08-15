'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui'
import {
  WinCloseIcon,
  WinMaximizeIcon,
  WinMinimizeIcon,
  WinRestoreIcon,
} from '@/components/ui/WindowChromeIcons'
import type { WindowBounds, WindowChromeOptions } from '@/config/desktop'
import { DEFAULT_WINDOW_CHROME } from '@/config/desktop'
import { RESIZE_HANDLES, maximizedSize, resolveDockPose, type ResizeEdge } from '@/lib/desktop/windowGeometry'
import { useWindowGeometry } from '@/hooks/desktop/useWindowGeometry'
import { useWindowDockAnim } from '@/hooks/desktop/useWindowDockAnim'

export type { ResizeEdge }

export interface WindowsWindowProps {
  id?: string
  title: string
  onClose?: () => void
  onMinimize?: () => void
  minimized?: boolean
  /** 无记忆时：首次是否最大化 */
  defaultMaximized?: boolean
  /** 有记忆时优先于 defaultPosition / width / height / defaultMaximized */
  rememberedBounds?: WindowBounds | null
  children?: React.ReactNode
  defaultPosition?: { x: number; y: number }
  width?: number
  height?: number
  draggable?: boolean
  resizable?: boolean
  maximizable?: boolean
  isActive?: boolean
  zIndex?: number
  onFocus?: () => void
  /** 拖拽/缩放/最大化结束后写入 store */
  onBoundsChange?: (bounds: WindowBounds) => void
  chrome?: Partial<WindowChromeOptions>
}

/**
 * 老版 Windows 风格弹窗 - 深蓝标题栏、可拖拽、可最小化到任务栏、四边/四角可调整大小
 */
export function WindowsWindow({
  id,
  title,
  onClose,
  onMinimize,
  minimized = false,
  defaultMaximized = false,
  rememberedBounds = null,
  children,
  defaultPosition,
  width: initialWidth = 400,
  height: initialHeight = 320,
  draggable: draggableProp,
  resizable: resizableProp,
  maximizable: maximizableProp,
  isActive = false,
  zIndex = 1000,
  onFocus,
  onBoundsChange,
  chrome: chromeProp,
}: WindowsWindowProps) {
  const t = useTranslations('window')
  const chrome = { ...DEFAULT_WINDOW_CHROME, ...chromeProp }
  const draggable = draggableProp ?? chrome.draggable
  const resizable = resizableProp ?? chrome.resizable
  const maximizable = maximizableProp ?? chrome.maximizable
  const minimizable = onMinimize != null && chrome.minimizable

  const geometry = useWindowGeometry({
    windowId: id,
    rememberedBounds,
    defaultPosition,
    defaultMaximized: maximizable ? defaultMaximized : false,
    width: initialWidth,
    height: initialHeight,
    draggable,
    onBoundsChange,
    onClose,
    onMinimize: minimizable ? onMinimize : undefined,
  })

  const initialDockPose =
    minimized
      ? resolveDockPose(
          id,
          geometry.seed.maximized ? maximizedSize().width : geometry.seed.size.width,
          geometry.seed.maximized ? maximizedSize().height : geometry.seed.size.height,
        )
      : null

  const { handleMaximize, chromeBusy, frameStyle, fullyHidden } = useWindowDockAnim({
    id,
    minimized,
    maximized: geometry.maximized,
    position: geometry.position,
    size: geometry.size,
    positionRef: geometry.positionRef,
    sizeRef: geometry.sizeRef,
    beforeMaximizeRef: geometry.beforeMaximizeRef,
    setPosition: geometry.setPosition,
    setSize: geometry.setSize,
    setMaximized: geometry.setMaximized,
    emitBounds: geometry.emitBounds,
    interactivelyMoving: geometry.interactivelyMoving,
    initialDockPose,
  })

  const [consumePointer, setConsumePointer] = useState(false)
  const showFocusShield = !isActive || consumePointer

  useEffect(() => {
    if (!consumePointer) return
    const release = () => setConsumePointer(false)
    window.addEventListener('mouseup', release, true)
    window.addEventListener('pointerup', release, true)
    return () => {
      window.removeEventListener('mouseup', release, true)
      window.removeEventListener('pointerup', release, true)
    }
  }, [consumePointer])

  // 最小化飞入结束后卸载 DOM（应用树一并卸载）；还原时再挂载并播放飞出动画
  if (fullyHidden) return null

  return (
    <div
      data-window-id={id}
      data-window-snap={!geometry.maximized && !minimized ? '1' : undefined}
      className={cn(
        'fixed flex flex-col bg-window text-on-chrome font-pixel',
        geometry.maximized
          ? 'border-0 rounded-none'
          : 'border-2 border-t-chrome-light border-l-chrome-light border-r-chrome-dark border-b-chrome-dark',
      )}
      style={{ ...frameStyle, zIndex }}
    >
      {!geometry.maximized &&
        resizable &&
        RESIZE_HANDLES.map(({ edge, className, cursor }) => (
          <div
            key={edge}
            className={cn('absolute z-10', className)}
            style={{ cursor }}
            onMouseDown={(e) => {
              onFocus?.()
              geometry.handleResizeMouseDown(e, edge)
            }}
            aria-hidden
          />
        ))}

      <div className='flex flex-col h-full min-h-0 relative'>
        <div
          className={cn(
            'flex items-center justify-between shrink-0 h-8 px-1 pr-0 select-none font-pixel',
            geometry.maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
          )}
          onMouseDown={(e) => {
            // 不活跃窗也可直接拖标题栏；顺带激活
            onFocus?.()
            geometry.handleTitleMouseDown(e)
          }}
          style={{ background: isActive ? 'var(--window-title-active)' : 'var(--window-title-inactive)' }}
        >
          <span className='text-[var(--window-title-text)] text-sm font-bold pl-2 truncate'>{title}</span>
          <div className='flex items-stretch shrink-0'>
            {minimizable && (
              <Button
                variant='title'
                size='icon-sm'
                aria-label={t('minimize')}
                disabled={chromeBusy}
                onClick={(e) => {
                  e.stopPropagation()
                  geometry.handleMinimizeClick()
                }}
              >
                <WinMinimizeIcon />
              </Button>
            )}
            {maximizable && (
              <Button
                variant='title'
                size='icon-sm'
                disabled={chromeBusy}
                onClick={(e) => {
                  e.stopPropagation()
                  handleMaximize()
                }}
                aria-label={geometry.maximized ? t('restore') : t('maximize')}
              >
                {geometry.maximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
              </Button>
            )}
            <Button
              variant='title'
              size='icon-sm'
              onClick={(e) => {
                e.stopPropagation()
                geometry.handleClose()
              }}
              aria-label={t('close')}
            >
              <WinCloseIcon />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'relative flex-1 min-h-0 bg-window-body font-pixel',
            geometry.maximized
              ? 'border-0'
              : 'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          )}
        >
          {/* 由应用自行管理滚动；勿用 overflow-auto，避免与内层列表叠出第二条滚动条（聚焦切换时会跳动） */}
          <div className='absolute inset-0 overflow-hidden'>{children}</div>
          {/* 仅遮罩内容区：标题栏/缩放边可直接操作不活跃窗 */}
          {showFocusShield && (
            <div
              className='absolute inset-0 z-[200]'
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConsumePointer(true)
                onFocus?.()
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setConsumePointer(true)
                onFocus?.()
              }}
              onDragOver={(e) => {
                const types = Array.from(e.dataTransfer?.types ?? [])
                if (!types.includes('application/x-vfs-path') && !types.includes('text/plain')) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={(e) => {
                const types = Array.from(e.dataTransfer?.types ?? [])
                if (!types.includes('application/x-vfs-path') && !types.includes('text/plain')) return
                e.preventDefault()
                e.stopPropagation()
                onFocus?.()
                setConsumePointer(true)
                const path = (
                  e.dataTransfer.getData('application/x-vfs-path') || e.dataTransfer.getData('text/plain')
                ).trim()
                if (!path.startsWith('/')) return
                const host = e.currentTarget.parentElement?.querySelector('[data-vfs-drop]')
                host?.dispatchEvent(new CustomEvent('vfs-drop', { detail: { path }, bubbles: true }))
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
