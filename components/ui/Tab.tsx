import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children?: ReactNode
}

/**
 * 深色内容区内的轻量 Tab（音乐播放器等）。
 */
export function Tab({ className, active = false, children, type = 'button', ...props }: TabProps) {
  return (
    <button
      type={type}
      className={cn(
        'h-6 px-2 text-[11px] inline-flex items-center gap-1 border font-pixel',
        active
          ? 'bg-[#333] border-[#666] text-accent'
          : 'bg-transparent border-transparent text-[#aaa] hover:text-[#ddd]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
