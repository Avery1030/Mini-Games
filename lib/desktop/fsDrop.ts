import type { DesktopAppId } from '@/config/desktop'
import { isServer } from '@/lib/env'

export type FsDropTarget = { type: 'desktop' } | { type: 'folder'; folderId: DesktopAppId } | { type: 'recycleBin' }

/**
 * 探测文件系统投放目标（自上而下）。
 * 优先命中桌面图标（文件夹 / 回收站），再命中 data-fs-drop 区域。
 * data-fs-drop: "desktop" | "recycleBin" | "folder:{id}"
 */
export function hitFsDropTarget(
  clientX: number,
  clientY: number,
  ignoreIds?: ReadonlySet<DesktopAppId>,
): FsDropTarget | null {
  if (isServer) return null
  const els = document.elementsFromPoint(clientX, clientY)

  for (const el of els) {
    const iconHost = (el as Element).closest?.('[data-desktop-icon]') as HTMLElement | null
    if (iconHost) {
      const id = iconHost.dataset.desktopIcon as DesktopAppId | undefined
      if (id && !ignoreIds?.has(id)) {
        if (id === 'recycleBin') return { type: 'recycleBin' }
        if (iconHost.dataset.fsKind === 'folder') return { type: 'folder', folderId: id }
      }
      // 非投放图标：继续向下找（可能落在窗口/空白投放区）
    }

    const dropHost = (el as Element).closest?.('[data-fs-drop]') as HTMLElement | null
    if (!dropHost) continue
    const raw = dropHost.dataset.fsDrop?.trim()
    if (!raw) continue
    if (raw === 'desktop') return { type: 'desktop' }
    if (raw === 'recycleBin') return { type: 'recycleBin' }
    if (raw.startsWith('folder:')) {
      const folderId = raw.slice('folder:'.length) as DesktopAppId
      if (ignoreIds?.has(folderId)) continue
      return { type: 'folder', folderId }
    }
  }

  return null
}
