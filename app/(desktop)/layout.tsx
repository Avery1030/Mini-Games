import type { Metadata } from 'next'
import { DesktopPage } from '@/components/desktop'

export const metadata: Metadata = {
  title: 'Avery Mini OS',
  description: '仿版 Windows 风格桌面界面',
}

/**
 * `/` 与 `/window/[slug]` 共用布局：桌面壳挂在 layout 上，
 * 语言切换 router.refresh 或深链切换时不会 remount 开机态与窗口状态。
 */
export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopPage />
      {children}
    </>
  )
}
