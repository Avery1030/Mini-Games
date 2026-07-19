import { cn } from '@/lib/cn'

/**
 * 桌面窗口内嵌应用的根节点高度类。
 * 窗口壳已用明确 height + flex 撑满，embedded 时用 h-full 即可，勿再用 min-h-[固定值] 卡住全屏。
 */
export function embeddedAppShell(embedded: boolean, className?: string) {
  return cn(
    'min-h-0',
    embedded ? 'h-full' : 'min-h-screen',
    className,
  )
}
