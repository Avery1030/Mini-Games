import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_ID,
  isValidCustomWallpaperSrc,
  isWallpaperId,
  type WallpaperId,
} from '@/config/wallpapers'
import { writeWallpaperBoot } from '@/utils/wallpaperBoot'

const SETTINGS_KEY = 'desktop-settings'
const MAX_GALLERY = 40
const IDB_NAME = 'mini-app-storage'
const IDB_STORE = 'kv'

export type WallpaperGalleryItem = {
  id: string
  /** 原图 CDN，用于桌面 */
  url: string
  /** 缩略图（可选） */
  thumbUrl?: string
  name?: string
  createdAt: number
}

let idbMigratePromise: Promise<void> | null = null

/** 一次性：把旧版 IndexedDB 设置迁回 localStorage，并删除 IDB 中的该项 */
function migrateSettingsFromIdbOnce(): Promise<void> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve()
  }
  if (idbMigratePromise) return idbMigratePromise

  idbMigratePromise = new Promise((resolve) => {
    const finish = () => {
      void deleteIdbSettingsKey()
      resolve()
    }

    if (localStorage.getItem(SETTINGS_KEY) != null) {
      finish()
      return
    }

    try {
      const req = indexedDB.open(IDB_NAME, 1)
      req.onerror = () => resolve()
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE)
        }
      }
      req.onsuccess = () => {
        const db = req.result
        try {
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.close()
            resolve()
            return
          }
          const tx = db.transaction(IDB_STORE, 'readonly')
          const getReq = tx.objectStore(IDB_STORE).get(SETTINGS_KEY)
          getReq.onerror = () => {
            db.close()
            resolve()
          }
          getReq.onsuccess = () => {
            const value = getReq.result
            if (typeof value === 'string' && value && localStorage.getItem(SETTINGS_KEY) == null) {
              try {
                // 若仍是超大 data URL，跳过，避免撑爆 localStorage
                if (value.length < 1_500_000) {
                  localStorage.setItem(SETTINGS_KEY, value)
                }
              } catch {
                // quota
              }
            }
            db.close()
            finish()
          }
        } catch {
          db.close()
          resolve()
        }
      }
    } catch {
      resolve()
    }
  })

  return idbMigratePromise
}

function deleteIdbSettingsKey(): void {
  if (typeof indexedDB === 'undefined') return
  try {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onsuccess = () => {
      const db = req.result
      try {
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.close()
          return
        }
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).delete(SETTINGS_KEY)
        tx.oncomplete = () => db.close()
        tx.onerror = () => db.close()
      } catch {
        db.close()
      }
    }
  } catch {
    // ignore
  }
}

const settingsStorage = {
  getItem: async (name: string) => {
    await migrateSettingsFromIdbOnce()
    return localStorage.getItem(name)
  },
  setItem: async (name: string, value: string) => {
    await migrateSettingsFromIdbOnce()
    localStorage.setItem(name, value)
  },
  removeItem: async (name: string) => {
    await migrateSettingsFromIdbOnce()
    localStorage.removeItem(name)
  },
}

function normalizeCustomSrc(raw: unknown): string | null {
  return isValidCustomWallpaperSrc(raw) ? raw : null
}

function normalizeGallery(raw: unknown): WallpaperGalleryItem[] {
  if (!Array.isArray(raw)) return []
  const items: WallpaperGalleryItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    if (!isValidCustomWallpaperSrc(e.url)) continue
    // 丢弃历史超大 data URL，只保留 http(s)
    if (typeof e.url === 'string' && e.url.startsWith('data:')) continue
    items.push({
      id: typeof e.id === 'string' ? e.id : `wp-${items.length}`,
      url: e.url,
      thumbUrl:
        isValidCustomWallpaperSrc(e.thumbUrl) && !String(e.thumbUrl).startsWith('data:')
          ? e.thumbUrl
          : undefined,
      name: typeof e.name === 'string' ? e.name : undefined,
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
    })
  }
  return items.slice(0, MAX_GALLERY)
}

function ensureGalleryHasUrl(
  gallery: WallpaperGalleryItem[],
  url: string | null,
): WallpaperGalleryItem[] {
  if (!url || !isValidCustomWallpaperSrc(url) || url.startsWith('data:')) return gallery
  if (gallery.some((g) => g.url === url || g.thumbUrl === url)) return gallery
  return [
    {
      id: `imported-${Date.now()}`,
      url,
      thumbUrl: url,
      name: '已应用壁纸',
      createdAt: Date.now(),
    },
    ...gallery,
  ].slice(0, MAX_GALLERY)
}

/** 若传入的是图库缩略图地址，升级为原图 url */
export function resolveFullWallpaperUrl(
  url: string | null | undefined,
  gallery: WallpaperGalleryItem[],
): string | null {
  if (!url || !isValidCustomWallpaperSrc(url) || url.startsWith('data:')) return null
  const hit = gallery.find((g) => g.url === url || g.thumbUrl === url)
  if (hit) return hit.url
  return url
}

interface SettingsState {
  wallpaperId: WallpaperId
  customWallpaperUrl: string | null
  /** 本应用上传/导入过的壁纸列表（本机或外链） */
  wallpaperGallery: WallpaperGalleryItem[]
  _hasHydrated: boolean
}

interface SettingsActions {
  setHasHydrated: (value: boolean) => void
  applyWallpaper: (wallpaperId: WallpaperId, customUrl?: string | null) => void
  addToWallpaperGallery: (item: Omit<WallpaperGalleryItem, 'id' | 'createdAt'> & { id?: string }) => void
  removeFromWallpaperGallery: (id: string) => void
  clearCustomWallpaper: () => void
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      wallpaperId: DEFAULT_WALLPAPER_ID,
      customWallpaperUrl: null,
      wallpaperGallery: [],
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      applyWallpaper: (id, customUrl) => {
        if (!isWallpaperId(id)) return
        if (id === CUSTOM_WALLPAPER_ID) {
          const raw = customUrl ?? get().customWallpaperUrl
          const url = resolveFullWallpaperUrl(raw, get().wallpaperGallery) ?? raw
          if (!url || !isValidCustomWallpaperSrc(url) || url.startsWith('data:')) return
          writeWallpaperBoot(CUSTOM_WALLPAPER_ID, url)
          set((state) => ({
            wallpaperId: CUSTOM_WALLPAPER_ID,
            customWallpaperUrl: url,
            wallpaperGallery: ensureGalleryHasUrl(state.wallpaperGallery, url),
          }))
          return
        }
        writeWallpaperBoot(id, get().customWallpaperUrl)
        set({ wallpaperId: id })
      },

      addToWallpaperGallery: (item) => {
        if (!isValidCustomWallpaperSrc(item.url) || item.url.startsWith('data:')) return
        set((state) => {
          const withoutDup = state.wallpaperGallery.filter((g) => g.url !== item.url)
          const next: WallpaperGalleryItem = {
            id: item.id ?? `wp-${Date.now()}`,
            url: item.url,
            thumbUrl: item.thumbUrl?.startsWith('data:') ? undefined : item.thumbUrl,
            name: item.name,
            createdAt: Date.now(),
          }
          return {
            wallpaperGallery: [next, ...withoutDup].slice(0, MAX_GALLERY),
          }
        })
      },

      removeFromWallpaperGallery: (id) => {
        set((state) => {
          const removed = state.wallpaperGallery.find((g) => g.id === id)
          const wallpaperGallery = state.wallpaperGallery.filter((g) => g.id !== id)
          if (removed && state.customWallpaperUrl === removed.url && state.wallpaperId === CUSTOM_WALLPAPER_ID) {
            writeWallpaperBoot(DEFAULT_WALLPAPER_ID, null)
            return {
              wallpaperGallery,
              customWallpaperUrl: null,
              wallpaperId: DEFAULT_WALLPAPER_ID,
            }
          }
          return { wallpaperGallery }
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
      version: 5,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        customWallpaperUrl: state.customWallpaperUrl,
        wallpaperGallery: state.wallpaperGallery,
      }),
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as {
          wallpaperId?: unknown
          customWallpaperUrl?: unknown
          customWallpaperDataUrl?: unknown
          wallpaperGallery?: unknown
        }
        let custom =
          normalizeCustomSrc(raw.customWallpaperUrl) ??
          normalizeCustomSrc(raw.customWallpaperDataUrl)
        if (custom?.startsWith('data:')) custom = null
        let wallpaperId = isWallpaperId(raw.wallpaperId) ? raw.wallpaperId : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        const gallery = ensureGalleryHasUrl(normalizeGallery(raw.wallpaperGallery), custom)
        return { wallpaperId, customWallpaperUrl: custom, wallpaperGallery: gallery }
      },
      merge: (persisted, current) => {
        const saved = persisted as {
          wallpaperId?: unknown
          customWallpaperUrl?: unknown
          customWallpaperDataUrl?: unknown
          wallpaperGallery?: unknown
        } | undefined
        let custom =
          normalizeCustomSrc(saved?.customWallpaperUrl) ??
          normalizeCustomSrc(saved?.customWallpaperDataUrl)
        if (custom?.startsWith('data:')) custom = null
        let wallpaperId = isWallpaperId(saved?.wallpaperId)
          ? saved.wallpaperId
          : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        const gallery = ensureGalleryHasUrl(normalizeGallery(saved?.wallpaperGallery), custom)
        return {
          ...current,
          wallpaperId,
          customWallpaperUrl: custom,
          wallpaperGallery: gallery,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const full = resolveFullWallpaperUrl(state.customWallpaperUrl, state.wallpaperGallery)
        if (full && full !== state.customWallpaperUrl) {
          state.customWallpaperUrl = full
        }
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
