import { cn } from '@/lib/cn'

/**
 * 桌面窗口内嵌应用的根节点高度类（默认填满窗口客户区）。
 * 若要整页独立打开，自行叠加 `min-h-screen`。
 */
export function embeddedAppShell(className?: string) {
  return cn('min-h-0 h-full', className)
}
