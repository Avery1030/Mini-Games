'use client'

import { type ReactNode } from 'react'
import { cn } from '../cn'
import { Button } from '../Button'
import { WinCloseIcon } from '../WindowChromeIcons'
import { winChromePanel } from '../theme'
import type { ModalAction } from './types'

export interface ModalFrameProps {
  title?: ReactNode
  children: ReactNode
  actions?: ModalAction[]
  showClose?: boolean
  widthClassName?: string
  zIndex: number
  /** 是否为最上层（接收 Esc） */
  isTop: boolean
  titleId?: string
  onAction: (actionId: string) => void
  onDismiss: () => void
  onRequestClose: () => void
  dismissible?: boolean
}

/**
 * Win95 风格对话框外壳（遮罩 + 标题栏 + 内容 + 按钮区）。
 */
export function ModalFrame({
  title,
  children,
  actions,
  showClose = true,
  widthClassName = 'w-[min(420px,calc(100vw-2rem))]',
  zIndex,
  isTop,
  titleId = 'modal-title',
  onAction,
  onDismiss,
  onRequestClose,
  dismissible = true,
}: ModalFrameProps) {
  return (
    <div className='fixed inset-0 flex items-center justify-center p-4' style={{ zIndex }} role='presentation'>
      <button
        type='button'
        aria-label='Dismiss'
        className='absolute inset-0 bg-black/45 cursor-default'
        tabIndex={-1}
        onClick={() => {
          if (dismissible) onDismiss()
        }}
      />

      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={title != null ? titleId : undefined}
        className={cn(
          winChromePanel,
          'relative flex flex-col font-pixel shadow-[var(--window-shadow)]',
          'box-border min-w-0 max-w-full shrink-0',
          widthClassName,
        )}
      >
        <div
          className='ui-titlebar flex items-center gap-2 h-7 px-1 text-[var(--window-title-text)] select-none'
        >
          <div id={titleId} className='flex-1 min-w-0 px-1 text-[12px] font-bold truncate'>
            {title}
          </div>
          {showClose && (
            <Button
              variant='title'
              size='icon-sm'
              className='shrink-0'
              aria-label='Close'
              onClick={onRequestClose}
            >
              <WinCloseIcon />
            </Button>
          )}
        </div>

        <div className='p-3 text-[12px] leading-relaxed text-on-chrome whitespace-pre-wrap break-words'>
          {children}
        </div>

        {actions && actions.length > 0 && (
          <div className='flex justify-end gap-2 px-3 pb-3'>
            {actions.map((action) => (
              <Button
                key={action.id}
                size='md'
                className={cn('min-w-[72px]', action.primary && 'font-bold')}
                autoFocus={action.primary && isTop}
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
