import { isClient } from '@/lib/env'
import { STORAGE_KEYS, type StorageKey } from './keys'
import type { JsonStorageKey, StorageSchema, ThemeStorageValue } from './schema'

export type { StorageKey, JsonStorageKey, StorageSchema, ThemeStorageValue }
export { STORAGE_KEYS, isStorageKey } from './keys'
export type {
  ZustandPersistEnvelope,
  SettingsPersistState,
  WindowsPersistState,
  CoordinatesPersistState,
  NotepadPersistState,
  PaintPersistState,
  WallpaperBootPersist,
} from './schema'

function canUseStorage(): boolean {
  return isClient && typeof localStorage !== 'undefined'
}

function readBrowser(key: string): Nullable<string> {
  if (!canUseStorage()) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeBrowser(key: string, value: string): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(key, value)
  } catch {
    // quota / private mode
  }
}

function removeBrowser(key: string): void {
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/**
 * 项目内唯一允许直接调用 `localStorage` 的实现。
 * 业务代码请用 `appStorage`；key 必须先登记到 `STORAGE_KEYS`。
 * 例外：主题 FOUC 内联脚本、烟花 iframe（无法 import 本模块）。
 */
export const appStorage = {
  /** 未登记 key 也走同一读写通道（唯一接触 localStorage 的实现） */
  getLoose(key: string): Nullable<string> {
    return readBrowser(key)
  },

  setLoose(key: string, value: string): void {
    writeBrowser(key, value)
  },

  removeLoose(key: string): void {
    removeBrowser(key)
  },

  getRaw(key: StorageKey): Nullable<string> {
    return appStorage.getLoose(key)
  },

  setRaw(key: StorageKey, value: string): void {
    appStorage.setLoose(key, value)
  },

  remove(key: StorageKey): void {
    appStorage.removeLoose(key)
  },

  has(key: StorageKey): boolean {
    return appStorage.getRaw(key) != null
  },

  getJson<K extends JsonStorageKey>(key: K): Nullable<StorageSchema[K]> {
    const raw = appStorage.getRaw(key)
    if (raw == null) return null
    try {
      return JSON.parse(raw) as StorageSchema[K]
    } catch {
      return null
    }
  },

  setJson<K extends JsonStorageKey>(key: K, value: StorageSchema[K]): void {
    try {
      appStorage.setRaw(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  },

  getTheme(): Nullable<ThemeStorageValue> {
    const raw = appStorage.getRaw(STORAGE_KEYS.theme)
    if (raw === 'light' || raw === 'dark') return raw
    return null
  },

  setTheme(value: ThemeStorageValue): void {
    appStorage.setRaw(STORAGE_KEYS.theme, value)
  },

  /**
   * Zustand `createJSONStorage(() => …)` 用的适配器。
   */
  createStateStorage(options?: {
    /** 每次读写前钩子 */
    before?: () => void | Promise<void>
  }): {
    getItem: (name: string) => Nullable<string> | Promise<Nullable<string>>
    setItem: (name: string, value: string) => void | Promise<void>
    removeItem: (name: string) => void | Promise<void>
  } {
    const before = options?.before

    return {
      getItem: async (name) => {
        if (before) await before()
        return appStorage.getLoose(name)
      },
      setItem: async (name, value) => {
        if (before) await before()
        appStorage.setLoose(name, value)
      },
      removeItem: async (name) => {
        if (before) await before()
        appStorage.removeLoose(name)
      },
    }
  },
}
