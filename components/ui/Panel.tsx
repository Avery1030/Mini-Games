import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { winChromeSunken } from '@/utils/winChrome'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  /** 默认带内边距 */
  padded?: boolean
  /** 浅灰内容底（设置页分组） */
  inset?: boolean
}

/**
 * 凹陷分组面板，用于设置页等 chrome 内容区。
 */
export function Panel({
  className,
  children,
  padded = true,
  inset = false,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        winChromeSunken,
        padded && 'p-3',
        inset && 'bg-[#f0f0f0] dark:bg-[#2a2a2a]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
