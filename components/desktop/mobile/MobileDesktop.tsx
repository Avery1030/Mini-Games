'use client'

import { useState } from 'react'
import { useDesktopWallpaper } from '@/hooks/desktop'
import { MobileStatusBar } from './MobileStatusBar'
import { MobileHomeGrid } from './MobileHomeGrid'
import { MobileDock, MOBILE_DOCK_APP_IDS } from './MobileDock'
import { MobileAppHost } from './MobileAppHost'
import { MobileRecents } from './MobileRecents'

/**
 * 手机主屏壳：状态栏 + App 网格 + Dock；前台应用由 MobileAppHost 全屏覆盖。
 */
export function MobileDesktop() {
  const desktopBgStyle = useDesktopWallpaper()
  const [recentsOpen, setRecentsOpen] = useState(false)

  return (
    <div
      className='flex h-[100dvh] min-h-screen w-screen flex-col overflow-hidden select-none'
      style={desktopBgStyle}
      data-mobile-desktop
    >
      <MobileStatusBar />
      <MobileHomeGrid dockIds={MOBILE_DOCK_APP_IDS} />
      <MobileDock recentsOpen={recentsOpen} onOpenRecents={() => setRecentsOpen(true)} />
      <MobileAppHost />
      <MobileRecents open={recentsOpen} onClose={() => setRecentsOpen(false)} />
    </div>
  )
}
