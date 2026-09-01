import type { Metadata, Viewport } from 'next'
import { DesktopPage } from '@/components/desktop'

export const metadata: Metadata = {
  // 标签页标题由 DesktopDocumentTitle 按聚焦窗口写入；这里不设 title，避免 Next 一直抢回默认名
  description: 'Avery Mini OS is a modern desktop operating system designed to be fast, secure, and easy to use.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
