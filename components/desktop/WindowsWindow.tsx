'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Window, type WindowResizeEdge } from '@/components/ui/window'
import type { WindowBounds, WindowChromeOptions } from '@/config/desktop'
import { DEFAULT_WINDOW_CHROME } from '@/config/desktop'
import { maximizedSize, resolveDockPose, type ResizeEdge } from '@/lib/desktop/windowGeometry'
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
  /** 有记忆时恢复位置、尺寸与最大化状态 */
  rememberedBounds?: Nullable<WindowBounds>
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
 * 桌面窗口适配器：把 OS 几何 / dock 动画 / i18n / VFS 焦点盾接到通用 Window 铬上。
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

  if (fullyHidden) return null

  return (
    <Window
      id={id}
      title={title}
      zIndex={zIndex}
      style={frameStyle}
      maximized={geometry.maximized}
      resizable={resizable}
      minimizable={minimizable}
      maximizable={maximizable}
      chromeBusy={chromeBusy}
      isActive={isActive}
      snapAttr={!geometry.maximized && !minimized}
      labels={{
        minimize: t('minimize'),
        maximize: t('maximize'),
        restore: t('restore'),
        close: t('close'),
      }}
      onFocus={onFocus}
      onTitleMouseDown={geometry.handleTitleMouseDown}
      onResizeMouseDown={(e, edge: WindowResizeEdge) => geometry.handleResizeMouseDown(e, edge)}
      onMinimize={geometry.handleMinimizeClick}
      onMaximize={handleMaximize}
      onClose={geometry.handleClose}
      bodyOverlay={
        showFocusShield ? (
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
        ) : null
      }
    >
      {children}
    </Window>
  )
}
