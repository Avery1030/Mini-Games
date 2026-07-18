'use client'

import { type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { winChromeSunken } from '@/utils/winChrome'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
}

/**
 * Win95 风格复选框：凹陷方框 + 勾选标记。
 * 勾选标记始终占位（invisible），避免勾选/取消时上下跳动。
 */
export function Checkbox({
  className,
  label,
  checked,
  disabled,
  id,
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 font-pixel text-[12px] text-on-chrome cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className='relative shrink-0 size-3.5'>
        <input
          id={id}
          type='checkbox'
          checked={checked}
          disabled={disabled}
          className='peer sr-only'
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            winChromeSunken,
            'absolute inset-0 flex items-center justify-center bg-field',
            'peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-[var(--window-title-active)]',
          )}
        >
          <span
            className={cn(
              'block size-full text-center text-[11px] leading-[14px] font-bold text-on-chrome',
              checked ? 'visible' : 'invisible',
            )}
          >
            ✓
          </span>
        </span>
      </span>
      {label != null && <span className='leading-snug'>{label}</span>}
    </label>
  )
}
