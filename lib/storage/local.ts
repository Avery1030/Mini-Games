import { isClient, isServer } from '@/lib/env'
import { STORAGE_KEYS, isStorageKey, type StorageKey } from './keys'
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

/**
 * 类型化 localStorage：
 * - getRaw / setRaw：字符串（zustand / next-themes）
 * - getJson / setJson：按 StorageSchema 解析
 * - createStateStorage：给 zustand persist 用
 */
export const appStorage = {
  getRaw(key: StorageKey): Nullable<string> {
    if (!canUseStorage()) return null
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },

  setRaw(key: StorageKey, value: string): void {
    if (!canUseStorage()) return
    try {
      localStorage.setItem(key, value)
    } catch {
      // quota / private mode
    }
  },

  remove(key: StorageKey): void {
    if (!canUseStorage()) return
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
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
   * `name` 必须是已登记的 StorageKey。
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
        if (!isStorageKey(name)) {
          if (isServer) return null
          try {
            return localStorage.getItem(name)
          } catch {
            return null
          }
        }
        return appStorage.getRaw(name)
      },
      setItem: async (name, value) => {
        if (before) await before()
        if (!isStorageKey(name)) {
          if (isServer) return
          try {
            localStorage.setItem(name, value)
          } catch {
            // ignore
          }
          return
        }
        appStorage.setRaw(name, value)
      },
      removeItem: async (name) => {
        if (before) await before()
        if (!isStorageKey(name)) {
          if (isServer) return
          try {
            localStorage.removeItem(name)
          } catch {
            // ignore
          }
          return
        }
        appStorage.remove(name)
      },
    }
  },
}
