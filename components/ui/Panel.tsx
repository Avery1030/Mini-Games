import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
  /** 默认带内边距 */
  padded?: boolean
  /** 分组内容底（跟随主题 token） */
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
        inset && 'bg-panel-inset',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
