import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { winChromeSunken } from '@/utils/winChrome'

export type InputSize = 'sm' | 'md'
export type InputTone = 'chrome' | 'field' | 'dark'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
  /** chrome=控件灰底；field=白底表单；dark=深色窗口内输入 */
  tone?: InputTone
}

const sizeClass: Record<InputSize, string> = {
  sm: 'h-6 px-2 text-[11px]',
  md: 'h-7 px-2 text-xs',
}

const toneClass: Record<InputTone, string> = {
  chrome: cn(winChromeSunken, 'bg-chrome'),
  field: cn(winChromeSunken, 'bg-white dark:bg-[#2a2a2a]'),
  dark: 'bg-[#111] border border-[#555] text-[#eee] focus:border-accent',
}

/**
 * Win95 凹陷输入框；深色 tone 用于音乐等深色内容区。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size = 'md', tone = 'field', type = 'text', disabled, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'min-w-0 w-full font-pixel outline-none',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClass[size],
        toneClass[tone],
        className,
      )}
      {...props}
    />
  )
})
