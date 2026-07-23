import type { Metadata } from 'next'
import { DesktopPage } from '@/components/desktop'

export const metadata: Metadata = {
  title: 'Avery Mini OS',
  description: '老版 Windows 风格桌面界面',
}

/** 动态路由仅作窗口标记；实际 UI 仍是全局桌面浮层。 */
export default function WindowRoutePage() {
  return <DesktopPage />
}
