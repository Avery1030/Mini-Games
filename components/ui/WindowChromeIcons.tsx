import { cn } from '@/lib/cn'

type IconProps = {
  className?: string
}

/** Win95 风格标题栏：最小化（底边横线） */
export function WinMinimizeIcon({ className }: IconProps) {
  return (
    <svg viewBox='0 0 12 12' width='12' height='12' className={cn('block shrink-0', className)} aria-hidden>
      <rect x='2' y='8.5' width='8' height='1.75' fill='currentColor' />
    </svg>
  )
}

/** Win95 风格标题栏：最大化（空心方框） */
export function WinMaximizeIcon({ className }: IconProps) {
  return (
    <svg viewBox='0 0 12 12' width='12' height='12' className={cn('block shrink-0', className)} aria-hidden>
      <path fill='currentColor' fillRule='evenodd' d='M1.5 1.5h9v9h-9v-9zm1.5 2.25v5.25h6V3.75H3z' />
    </svg>
  )
}

/** Win95 风格标题栏：还原（前窗完整方框 + 后窗顶边/右边） */
export function WinRestoreIcon({ className }: IconProps) {
  return (
    <svg viewBox='0 0 12 12' width='12' height='12' className={cn('block shrink-0', className)} aria-hidden>
      <rect x='3.75' y='1.2' width='7' height='1.65' fill='currentColor' />
      <rect x='9.1' y='1.2' width='1.65' height='5.6' fill='currentColor' />
      <path fill='currentColor' fillRule='evenodd' d='M1.2 3.55h7.1v7.1H1.2V3.55zm1.55 1.7v3.9h4v-3.9h-4z' />
    </svg>
  )
}

/** Win95 风格标题栏：关闭（粗 X） */
export function WinCloseIcon({ className }: IconProps) {
  return (
    <svg viewBox='0 0 12 12' width='12' height='12' className={cn('block shrink-0', className)} aria-hidden>
      <path
        fill='currentColor'
        d='M2.05 1.15 6 5.1l3.95-3.95 1.2 1.2L7.2 6.3l3.95 3.95-1.2 1.2L6 7.5l-3.95 3.95-1.2-1.2L4.8 6.3 0.85 2.35z'
      />
    </svg>
  )
}
