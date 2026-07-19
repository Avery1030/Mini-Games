import type { Metadata } from 'next'
import { DesktopShell } from '@/components/desktop'

export const metadata: Metadata = {
  title: 'Avery Mini OS',
  description: '老版 Windows 风格桌面界面',
}

export default function Home() {
  return (
    <main className='min-h-screen w-screen overflow-hidden'>
      <DesktopShell />
    </main>
  )
}
