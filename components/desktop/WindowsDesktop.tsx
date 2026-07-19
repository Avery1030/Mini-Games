'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DesktopIconsLayer, useVisibleDesktopIcons } from './DesktopIconsLayer'
import { DesktopWindowsLayer } from './DesktopWindowsLayer'
import { DesktopTaskbar } from './DesktopTaskbar'
import { ContextMenu, type ContextMenuState } from '@/components/ui'
import type { DesktopAppId } from '@/config/desktop'
import { useDesktopWallpaper } from '@/hooks/desktop'
import { useWindowStore } from '@/store/window'

/**
 * 桌面编排：壁纸 + 图标层 + 窗口层 + 任务栏 + 右键菜单。
 * 各层自行订阅 store，彼此不互相 import。
 */
export function WindowsDesktop() {
  const td = useTranslations('desktop')
  const desktopBgStyle = useDesktopWallpaper()
  const openWindow = useWindowStore((s) => s.openWindow)
  const desktopIcons = useVisibleDesktopIcons()
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const closeContextMenu = () => setContextMenu(null)

  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const target = e.target as Element | null
    if (target?.closest?.('[data-window-id]')) return

    const iconEl = target?.closest?.('[data-desktop-icon]') as HTMLElement | null
    const iconId = (iconEl?.dataset.desktopIcon ?? null) as DesktopAppId | null
    const app = iconId ? desktopIcons.find((a) => a.id === iconId) : undefined
    const canOpen = Boolean(app?.app)

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          id: 'open',
          label: td('open'),
          disabled: !canOpen,
          onSelect: () => {
            if (iconId && canOpen) openWindow(iconId)
          },
        },
        {
          id: 'refresh',
          label: td('refresh'),
          onSelect: () => {
            window.location.reload()
          },
        },
      ],
    })
  }

  return (
    <div className='min-h-screen flex flex-col select-none font-pixel text-on-desktop' style={desktopBgStyle}>
      <div className='flex-1 relative overflow-hidden p-[2rem_2rem_.5rem]' onContextMenu={handleDesktopContextMenu}>
        {/* grid 放在无 padding 的内层，absolute 让位时与 grid 原点一致 */}
        <DesktopIconsLayer />
        <DesktopWindowsLayer />
      </div>

      <DesktopTaskbar />
      <ContextMenu menu={contextMenu} onClose={closeContextMenu} />
    </div>
  )
}
