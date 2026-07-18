import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_ID,
  isValidCustomWallpaperSrc,
  isWallpaperId,
  type WallpaperId,
} from '@/config/wallpapers'
import { idbKVStorage } from '@/utils/idbStorage'
import { writeWallpaperBoot } from '@/utils/wallpaperBoot'

const SETTINGS_KEY = 'desktop-settings'

let settingsMigrated = false

async function migrateSettingsFromLocalStorage() {
  if (settingsMigrated || typeof window === 'undefined') return
  settingsMigrated = true
  try {
    const legacy = localStorage.getItem(SETTINGS_KEY)
    if (!legacy) return
    const existing = await idbKVStorage.getItem(SETTINGS_KEY)
    if (existing == null) {
      await idbKVStorage.setItem(SETTINGS_KEY, legacy)
    }
    localStorage.removeItem(SETTINGS_KEY)
  } catch {
    // ignore
  }
}

const settingsStorage = {
  getItem: async (name: string) => {
    await migrateSettingsFromLocalStorage()
    return idbKVStorage.getItem(name)
  },
  setItem: async (name: string, value: string) => {
    await migrateSettingsFromLocalStorage()
    return idbKVStorage.setItem(name, value)
  },
  removeItem: async (name: string) => {
    await migrateSettingsFromLocalStorage()
    return idbKVStorage.removeItem(name)
  },
}

function normalizeCustomSrc(raw: unknown): string | null {
  return isValidCustomWallpaperSrc(raw) ? raw : null
}

interface SettingsState {
  wallpaperId: WallpaperId
  /** 自定义壁纸：优先 CDN URL；兼容旧版 data URL */
  customWallpaperUrl: string | null
  _hasHydrated: boolean
}

interface SettingsActions {
  setHasHydrated: (value: boolean) => void
  setWallpaperId: (id: WallpaperId) => void
  setCustomWallpaper: (url: string) => void
  clearCustomWallpaper: () => void
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      wallpaperId: DEFAULT_WALLPAPER_ID,
      customWallpaperUrl: null,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setWallpaperId: (id) => {
        if (!isWallpaperId(id)) return
        if (id === CUSTOM_WALLPAPER_ID && !get().customWallpaperUrl) return
        writeWallpaperBoot(id, get().customWallpaperUrl)
        set({ wallpaperId: id })
      },

      setCustomWallpaper: (url) => {
        if (!isValidCustomWallpaperSrc(url)) return
        writeWallpaperBoot(CUSTOM_WALLPAPER_ID, url)
        set({
          customWallpaperUrl: url,
          wallpaperId: CUSTOM_WALLPAPER_ID,
        })
      },

      clearCustomWallpaper: () => {
        const { wallpaperId } = get()
        const nextId = wallpaperId === CUSTOM_WALLPAPER_ID ? DEFAULT_WALLPAPER_ID : wallpaperId
        writeWallpaperBoot(nextId, null)
        set({
          customWallpaperUrl: null,
          wallpaperId: nextId,
        })
      },
    }),
    {
      name: SETTINGS_KEY,
      version: 3,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        customWallpaperUrl: state.customWallpaperUrl,
      }),
      migrate: (persisted, version) => {
        const raw = (persisted ?? {}) as {
          wallpaperId?: unknown
          customWallpaperUrl?: unknown
          customWallpaperDataUrl?: unknown
        }
        const custom =
          normalizeCustomSrc(raw.customWallpaperUrl) ??
          normalizeCustomSrc(raw.customWallpaperDataUrl)
        let wallpaperId = isWallpaperId(raw.wallpaperId) ? raw.wallpaperId : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        void version
        return { wallpaperId, customWallpaperUrl: custom }
      },
      merge: (persisted, current) => {
        const saved = persisted as {
          wallpaperId?: unknown
          customWallpaperUrl?: unknown
          customWallpaperDataUrl?: unknown
        } | undefined
        const custom =
          normalizeCustomSrc(saved?.customWallpaperUrl) ??
          normalizeCustomSrc(saved?.customWallpaperDataUrl)
        let wallpaperId = isWallpaperId(saved?.wallpaperId)
          ? saved.wallpaperId
          : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        return {
          ...current,
          wallpaperId,
          customWallpaperUrl: custom,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        writeWallpaperBoot(state.wallpaperId, state.customWallpaperUrl)
        state.setHasHydrated(true)
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  const markHydrated = () => {
    const s = useSettingsStore.getState()
    if (!s._hasHydrated) {
      writeWallpaperBoot(s.wallpaperId, s.customWallpaperUrl)
      useSettingsStore.setState({ _hasHydrated: true })
    }
  }
  useSettingsStore.persist.onFinishHydration(markHydrated)
  if (useSettingsStore.persist.hasHydrated()) {
    markHydrated()
  }
}
