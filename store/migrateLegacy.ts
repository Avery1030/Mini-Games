import type { DesktopAppId, DesktopWindowRuntime } from '@/config/desktop'
import type { DesktopCoordinate } from '@/lib/desktop'
import { isServer } from '@/lib/env'

const LEGACY_KEY = 'desktop-app-windows'
const WINDOWS_KEY = 'desktop-windows'
const COORDINATES_KEY = 'desktop-coordinates'

type LegacyAppState = {
  id: DesktopAppId
  isOpen?: boolean
  minimized?: boolean
  active?: boolean
  zIndex?: number
  coordinate?: DesktopCoordinate
}

type LegacyPersist = {
  state?: {
    apps?: LegacyAppState[]
    topZIndex?: number
  }
  version?: number
}

let migrated = false

/**
 * 将旧版单一 persist（含窗口 + 坐标）拆到两个新 key。
 * 在任一新 store 读 storage 前调用；只执行一次。
 */
export function migrateLegacyDesktopPersist(): void {
  if (migrated || isServer) return
  migrated = true

  const hasNew = localStorage.getItem(WINDOWS_KEY) != null || localStorage.getItem(COORDINATES_KEY) != null
  if (hasNew) {
    localStorage.removeItem(LEGACY_KEY)
    return
  }

  const raw = localStorage.getItem(LEGACY_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as LegacyPersist
    const apps = parsed.state?.apps
    if (!apps?.length) {
      localStorage.removeItem(LEGACY_KEY)
      return
    }

    const windows: Partial<Record<DesktopAppId, DesktopWindowRuntime>> = {}
    const coordinates: Partial<Record<DesktopAppId, DesktopCoordinate>> = {}

    for (const app of apps) {
      windows[app.id] = {
        isOpen: app.isOpen ?? false,
        minimized: app.minimized ?? false,
        active: app.active ?? false,
        zIndex: app.zIndex ?? 0,
        openOrder: app.isOpen ? (app.zIndex ?? 0) : 0,
      }
      if (app.coordinate) {
        coordinates[app.id] = app.coordinate
      }
    }

    localStorage.setItem(
      WINDOWS_KEY,
      JSON.stringify({
        state: {
          windows,
          topZIndex: parsed.state?.topZIndex ?? 1000,
        },
        version: 1,
      }),
    )
    localStorage.setItem(
      COORDINATES_KEY,
      JSON.stringify({
        state: { coordinates },
        version: 1,
      }),
    )
  } catch {
    // 旧数据损坏则丢弃
  }

  localStorage.removeItem(LEGACY_KEY)
}

export { WINDOWS_KEY, COORDINATES_KEY }
