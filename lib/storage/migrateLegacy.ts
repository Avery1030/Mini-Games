import type { DesktopAppId, DesktopWindowRuntime } from '@/config/desktop'
import type { DesktopCoordinate } from '@/lib/desktop'
import { isServer } from '@/lib/env'
import {
  STORAGE_KEYS,
  appStorage,
  type LegacyDesktopPersistState,
  type WindowsPersistState,
  type CoordinatesPersistState,
} from '@/lib/storage'

let migrated = false

/**
 * 将旧版单一 persist（含窗口 + 坐标）拆到两个新 key。
 * 在任一新 store 读 storage 前调用；只执行一次。
 */
export function migrateLegacyDesktopPersist(): void {
  if (migrated || isServer) return
  migrated = true

  const hasNew = appStorage.has(STORAGE_KEYS.windows) || appStorage.has(STORAGE_KEYS.coordinates)
  if (hasNew) {
    appStorage.remove(STORAGE_KEYS.legacyDesktop)
    return
  }

  const parsed = appStorage.getJson(STORAGE_KEYS.legacyDesktop)
  if (!parsed) return

  try {
    const apps = parsed.state?.apps
    if (!apps?.length) {
      appStorage.remove(STORAGE_KEYS.legacyDesktop)
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
        bounds: null,
      }
      if (app.coordinate) {
        coordinates[app.id] = app.coordinate
      }
    }

    const windowsEnvelope = {
      state: {
        windows: windows as WindowsPersistState['windows'],
        topZIndex: parsed.state?.topZIndex ?? 1000,
      },
      version: 1,
    }
    const coordinatesEnvelope = {
      state: {
        coordinates: coordinates as CoordinatesPersistState['coordinates'],
      },
      version: 1,
    }

    appStorage.setJson(STORAGE_KEYS.windows, windowsEnvelope)
    appStorage.setJson(STORAGE_KEYS.coordinates, coordinatesEnvelope)
  } catch {
    // 旧数据损坏则丢弃
  }

  appStorage.remove(STORAGE_KEYS.legacyDesktop)
}

export { STORAGE_KEYS }
export const WINDOWS_KEY = STORAGE_KEYS.windows
export const COORDINATES_KEY = STORAGE_KEYS.coordinates

export type { LegacyDesktopPersistState }
