'use client'

import { type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './cn'

export type SwitchSize = 'sm' | 'md'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange'> {
  size?: SwitchSize
  label?: ReactNode
  /** 受控选中态 */
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /**
   * 仅展示状态、不可交互（用于按钮角标等嵌套场景）。
   * 为 true 时不渲染 input，避免嵌套可聚焦控件。
   */
  readOnly?: boolean
}

const trackSize: Record<SwitchSize, string> = {
  sm: 'h-3 w-5 p-px',
  md: 'h-4 w-7 p-0.5',
}

const thumbSize: Record<SwitchSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
}

const thumbOn: Record<SwitchSize, string> = {
  sm: 'translate-x-[8px]',
  md: 'translate-x-[12px]',
}

function SwitchTrack({ size, checked }: { size: SwitchSize; checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center border border-chrome-dark transition-colors',
        trackSize[size],
        checked ? 'bg-green-700' : 'bg-chrome-dark',
      )}
    >
      <span
        className={cn(
          'bg-chrome shadow transition-transform',
          thumbSize[size],
          checked ? thumbOn[size] : 'translate-x-0',
        )}
      />
    </span>
  )
}

/**
 * Win95 风格开关：凹陷轨道 + 滑动滑块，开启时轨道为绿色。
 */
export function Switch({
  className,
  size = 'md',
  label,
  checked = false,
  disabled,
  readOnly = false,
  id,
  onCheckedChange,
  ...props
}: SwitchProps) {
  if (readOnly) {
    return (
      <span
        role='switch'
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        className={cn('inline-flex items-center', disabled && 'opacity-50', className)}
      >
        <SwitchTrack size={size} checked={checked} />
        {label != null && <span className='ml-2 font-pixel text-[12px] text-on-chrome leading-snug'>{label}</span>}
      </span>
    )
  }

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 font-pixel text-[12px] text-on-chrome cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      <span className='relative inline-flex'>
        <input
          id={id}
          type='checkbox'
          role='switch'
          checked={checked}
          disabled={disabled}
          className='peer sr-only'
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <span className='peer-focus-visible:outline peer-focus-visible:outline-[var(--window-title-active)]'>
          <SwitchTrack size={size} checked={checked} />
        </span>
      </span>
      {label != null && <span className='leading-snug'>{label}</span>}
    </label>
  )
}
