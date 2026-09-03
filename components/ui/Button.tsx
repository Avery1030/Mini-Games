import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'
import { winChrome, winChromePressed } from './theme'

export type ButtonVariant = 'raised' | 'pressed' | 'title'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon' | 'icon-lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 显示加载态并禁用点击 */
  loading?: boolean
  /** 切换类按钮的高亮（如随机/循环） */
  active?: boolean
  children?: ReactNode
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-6 px-2 text-[11px] gap-1',
  md: 'h-7 px-3 text-xs gap-1',
  lg: 'h-9 px-4 text-sm gap-1.5',
  'icon-sm': 'w-6 h-6 p-0',
  icon: 'w-7 h-7 p-0',
  'icon-lg': 'w-9 h-9 p-0',
}

/**
 * Win95 立体按钮：凸起 / 按下 / 标题栏小按钮。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'raised',
    size = 'md',
    loading = false,
    active = false,
    disabled,
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  const isIcon = size.startsWith('icon')
  const chrome = variant === 'pressed' ? winChromePressed : winChrome

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        chrome,
        'inline-flex items-center justify-center font-pixel select-none shrink-0',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        sizeClass[size],
        variant === 'title' && 'hover:bg-window-btn-hover hover:text-white font-bold text-xs',
        !isIcon && 'font-medium',
        active && 'text-on-chrome font-bold',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className='animate-spin' /> : null}
      {loading && isIcon ? null : children}
    </button>
  )
})
