import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { winChrome, winChromePressed } from '@/lib/winChrome'

/** 工具栏图标按钮 */
export function ToolBtn({
  label,
  icon,
  onClick,
  disabled,
  active,
  badge,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
  badge?: ReactNode
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className='flex flex-col items-center gap-1 disabled:opacity-40'
    >
      <span className='relative'>
        <span
          className={cn(active ? winChromePressed : winChrome, 'h-10 w-10 inline-flex items-center justify-center')}
        >
          {icon}
        </span>
        {badge}
      </span>
      <span className='text-[11px] font-medium'>{label}</span>
    </button>
  )
}

/** 菜单/设置列表项按钮 */
export function MenuActionBtn({
  label,
  onClick,
  muted,
}: {
  label: string
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(winChrome, 'w-full px-3 py-1.5 text-sm text-left', muted && 'text-muted')}
    >
      {label}
    </button>
  )
}
