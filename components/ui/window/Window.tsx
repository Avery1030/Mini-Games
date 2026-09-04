'use client'

import type { MouseEvent } from 'react'
import { Button } from '../Button'
import { cn } from '../cn'
import { WinCloseIcon, WinMaximizeIcon, WinMinimizeIcon, WinRestoreIcon } from '../WindowChromeIcons'
import type { WindowProps, WindowResizeEdge } from './types'

export type { WindowLabels, WindowProps, WindowResizeEdge } from './types'

const RESIZE_HANDLES: { edge: WindowResizeEdge; className: string; cursor: string }[] = [
  { edge: 'n', className: 'left-0 right-0 top-0 h-[5px]', cursor: 'ns-resize' },
  { edge: 's', className: 'left-0 right-0 bottom-0 h-[5px]', cursor: 's-resize' },
  { edge: 'e', className: 'right-0 top-0 bottom-0 w-[5px]', cursor: 'ew-resize' },
  { edge: 'w', className: 'left-0 top-0 bottom-0 w-[5px]', cursor: 'w-resize' },
  { edge: 'ne', className: 'right-0 top-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
  { edge: 'nw', className: 'left-0 top-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
  { edge: 'se', className: 'right-0 bottom-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
  { edge: 'sw', className: 'left-0 bottom-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
]

/**
 * 无业务窗口铬：标题栏、缩放柄、min/max/close。
 * 几何、i18n、VFS 拖放由调用方注入。
 */
export function Window({
  id,
  title,
  children,
  bodyOverlay,
  className,
  style,
  zIndex = 1000,
  maximized = false,
  resizable = false,
  minimizable = false,
  maximizable = false,
  chromeBusy = false,
  isActive = false,
  snapAttr = false,
  labels,
  onFocus,
  onTitleMouseDown,
  onResizeMouseDown,
  onMinimize,
  onMaximize,
  onClose,
}: WindowProps) {
  return (
    <div
      data-window-id={id}
      data-window-snap={snapAttr ? '1' : undefined}
      className={cn(
        'fixed flex flex-col bg-window text-on-chrome font-pixel ui-window',
        maximized && 'ui-window-max',
        className,
      )}
      style={{ ...style, zIndex }}
    >
      {!maximized &&
        resizable &&
        RESIZE_HANDLES.map(({ edge, className: handleClass, cursor }) => (
          <div
            key={edge}
            aria-hidden
            className={cn('absolute z-10', handleClass)}
            style={{ cursor }}
            onMouseDown={(e) => {
              onFocus?.()
              onResizeMouseDown?.(e, edge)
            }}
          />
        ))}

      <div className='flex flex-col h-full min-h-0 relative'>
        <div
          className={cn(
            'ui-titlebar flex items-center justify-between shrink-0 h-8 px-1 pr-1 select-none font-pixel',
            maximized ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
          )}
          data-inactive={isActive ? undefined : ''}
          onMouseDown={(e: MouseEvent<HTMLDivElement>) => {
            onFocus?.()
            onTitleMouseDown?.(e)
          }}
        >
          <span className='text-[var(--window-title-text)] text-sm font-bold pl-2 truncate'>{title}</span>
          <div className='flex items-stretch shrink-0'>
            {minimizable && (
              <Button
                variant='title'
                size='icon-sm'
                aria-label={labels.minimize}
                disabled={chromeBusy}
                onClick={(e) => {
                  e.stopPropagation()
                  onMinimize?.()
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
                  onMaximize?.()
                }}
                aria-label={maximized ? labels.restore : labels.maximize}
              >
                {maximized ? <WinRestoreIcon /> : <WinMaximizeIcon />}
              </Button>
            )}
            <Button
              variant='title'
              size='icon-sm'
              onClick={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
              aria-label={labels.close}
            >
              <WinCloseIcon />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            'relative flex-1 min-h-0 bg-window-body font-pixel',
            maximized ? 'border-0' : 'ui-sunken',
          )}
        >
          <div className='absolute inset-0 overflow-hidden'>{children}</div>
          {bodyOverlay}
        </div>
      </div>
    </div>
  )
}
