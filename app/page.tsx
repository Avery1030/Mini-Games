import type { Metadata } from 'next'
import { WindowsDesktop } from './components/WindowsDesktop'

export const metadata: Metadata = {
  title: 'Avery',
  description: '老版 Windows 风格桌面界面',
}

export default function Home() {
  return (
    <main className='min-h-screen w-screen overflow-hidden'>
      <WindowsDesktop />
    </main>
  )
}
