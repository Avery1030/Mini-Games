import { DesktopShell } from './DesktopShell'

/** `/` 与 `/window/[slug]` 共用的桌面入口，保证硬刷新深链仍进同一浮层壳。 */
export function DesktopPage() {
  return (
    <main className='min-h-screen w-screen overflow-hidden'>
      <DesktopShell />
    </main>
  )
}
