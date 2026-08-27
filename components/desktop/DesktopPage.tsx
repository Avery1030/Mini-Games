import { DesktopShell } from './DesktopShell'

/** 桌面入口（挂在 `(desktop)` layout）：硬刷新深链与语言切换均不 remount 壳层。 */
export function DesktopPage() {
  return (
    <main className='h-[100dvh] w-full overflow-hidden'>
      <DesktopShell />
    </main>
  )
}
