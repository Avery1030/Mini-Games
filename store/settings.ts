import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_ID,
  isValidCustomWallpaperSrc,
  isWallpaperId,
  type WallpaperId,
} from '@/config/wallpapers'
import { writeWallpaperBoot } from '@/lib/wallpaper'
import { isServer, isClient } from '@/lib/env'
import { isUiScale, type UiScale } from '@/lib/uiScale'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

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
  if (isServer || typeof indexedDB === 'undefined') {
    return Promise.resolve()
  }
  if (idbMigratePromise) return idbMigratePromise

  idbMigratePromise = new Promise((resolve) => {
    const finish = () => {
      void deleteIdbSettingsKey()
      resolve()
    }

    if (appStorage.has(STORAGE_KEYS.settings)) {
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
          const getReq = tx.objectStore(IDB_STORE).get(STORAGE_KEYS.settings)
          getReq.onerror = () => {
            db.close()
            resolve()
          }
          getReq.onsuccess = () => {
            const value = getReq.result
            if (typeof value === 'string' && value && !appStorage.has(STORAGE_KEYS.settings)) {
              try {
                // 若仍是超大 data URL，跳过，避免撑爆 localStorage
                if (value.length < 1_500_000) {
                  appStorage.setRaw(STORAGE_KEYS.settings, value)
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
        tx.objectStore(IDB_STORE).delete(STORAGE_KEYS.settings)
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

const settingsStorage = appStorage.createStateStorage({
  before: () => migrateSettingsFromIdbOnce(),
})

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
        isValidCustomWallpaperSrc(e.thumbUrl) && !String(e.thumbUrl).startsWith('data:') ? e.thumbUrl : undefined,
      name: typeof e.name === 'string' ? e.name : undefined,
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now(),
    })
  }
  return items.slice(0, MAX_GALLERY)
}

function ensureGalleryHasUrl(gallery: WallpaperGalleryItem[], url: string | null): WallpaperGalleryItem[] {
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
  /** 桌面图标是否显示文字 */
  showIconLabels: boolean
  /** 桌面图标视觉尺寸 */
  iconSize: 'sm' | 'md' | 'lg'
  /** 系统文字与图标整体缩放 */
  uiScale: UiScale
  /** 隐藏尚未实现窗口的占位图标 */
  hidePlaceholderIcons: boolean
  /** 任务栏显示时钟 */
  showTaskbarClock: boolean
  clockFormat: '24h' | '12h'
  /** 任务栏右侧装饰托盘图标 */
  showTrayDecor: boolean
  _hasHydrated: boolean
}

interface SettingsActions {
  setHasHydrated: (value: boolean) => void
  applyWallpaper: (wallpaperId: WallpaperId, customUrl?: string | null) => void
  addToWallpaperGallery: (item: Omit<WallpaperGalleryItem, 'id' | 'createdAt'> & { id?: string }) => void
  removeFromWallpaperGallery: (id: string) => void
  clearCustomWallpaper: () => void
  setShowIconLabels: (value: boolean) => void
  setIconSize: (value: 'sm' | 'md' | 'lg') => void
  setUiScale: (value: UiScale) => void
  setHidePlaceholderIcons: (value: boolean) => void
  setShowTaskbarClock: (value: boolean) => void
  setClockFormat: (value: '24h' | '12h') => void
  setShowTrayDecor: (value: boolean) => void
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      wallpaperId: DEFAULT_WALLPAPER_ID,
      customWallpaperUrl: null,
      wallpaperGallery: [],
      showIconLabels: true,
      iconSize: 'md',
      uiScale: 'md',
      hidePlaceholderIcons: false,
      showTaskbarClock: true,
      clockFormat: '24h',
      showTrayDecor: true,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      setShowIconLabels: (value) => set({ showIconLabels: value }),
      setIconSize: (value) => {
        if (value === 'sm' || value === 'md' || value === 'lg') set({ iconSize: value })
      },
      setUiScale: (value) => {
        if (isUiScale(value)) set({ uiScale: value })
      },
      setHidePlaceholderIcons: (value) => set({ hidePlaceholderIcons: value }),
      setShowTaskbarClock: (value) => set({ showTaskbarClock: value }),
      setClockFormat: (value) => {
        if (value === '12h' || value === '24h') set({ clockFormat: value })
      },
      setShowTrayDecor: (value) => set({ showTrayDecor: value }),

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
      name: STORAGE_KEYS.settings,
      version: 9,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        customWallpaperUrl: state.customWallpaperUrl,
        wallpaperGallery: state.wallpaperGallery,
        showIconLabels: state.showIconLabels,
        iconSize: state.iconSize,
        uiScale: state.uiScale,
        hidePlaceholderIcons: state.hidePlaceholderIcons,
        showTaskbarClock: state.showTaskbarClock,
        clockFormat: state.clockFormat,
        showTrayDecor: state.showTrayDecor,
      }),
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as {
          wallpaperId?: unknown
          customWallpaperUrl?: unknown
          customWallpaperDataUrl?: unknown
          wallpaperGallery?: unknown
          showIconLabels?: unknown
          iconSize?: unknown
          uiScale?: unknown
          hidePlaceholderIcons?: unknown
          showTaskbarClock?: unknown
          clockFormat?: unknown
          showTrayDecor?: unknown
        }
        let custom = normalizeCustomSrc(raw.customWallpaperUrl) ?? normalizeCustomSrc(raw.customWallpaperDataUrl)
        if (custom?.startsWith('data:')) custom = null
        let wallpaperId = isWallpaperId(raw.wallpaperId) ? raw.wallpaperId : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        const gallery = ensureGalleryHasUrl(normalizeGallery(raw.wallpaperGallery), custom)
        const iconSize = raw.iconSize === 'sm' || raw.iconSize === 'md' || raw.iconSize === 'lg' ? raw.iconSize : 'md'
        const uiScale = isUiScale(raw.uiScale) ? raw.uiScale : 'md'
        const clockFormat = raw.clockFormat === '12h' || raw.clockFormat === '24h' ? raw.clockFormat : '24h'
        return {
          wallpaperId,
          customWallpaperUrl: custom,
          wallpaperGallery: gallery,
          showIconLabels: raw.showIconLabels !== false,
          iconSize,
          uiScale,
          hidePlaceholderIcons: raw.hidePlaceholderIcons === true,
          showTaskbarClock: raw.showTaskbarClock !== false,
          clockFormat,
          showTrayDecor: raw.showTrayDecor !== false,
        }
      },
      merge: (persisted, current) => {
        const saved = persisted as
          | {
              wallpaperId?: unknown
              customWallpaperUrl?: unknown
              customWallpaperDataUrl?: unknown
              wallpaperGallery?: unknown
              showIconLabels?: unknown
              iconSize?: unknown
              uiScale?: unknown
              hidePlaceholderIcons?: unknown
              showTaskbarClock?: unknown
              clockFormat?: unknown
              showTrayDecor?: unknown
            }
          | undefined
        let custom = normalizeCustomSrc(saved?.customWallpaperUrl) ?? normalizeCustomSrc(saved?.customWallpaperDataUrl)
        if (custom?.startsWith('data:')) custom = null
        let wallpaperId = isWallpaperId(saved?.wallpaperId) ? saved.wallpaperId : DEFAULT_WALLPAPER_ID
        if (wallpaperId === CUSTOM_WALLPAPER_ID && !custom) {
          wallpaperId = DEFAULT_WALLPAPER_ID
        }
        const gallery = ensureGalleryHasUrl(normalizeGallery(saved?.wallpaperGallery), custom)
        const iconSize =
          saved?.iconSize === 'sm' || saved?.iconSize === 'md' || saved?.iconSize === 'lg' ? saved.iconSize : 'md'
        const uiScale = isUiScale(saved?.uiScale) ? saved.uiScale : 'md'
        const clockFormat = saved?.clockFormat === '12h' || saved?.clockFormat === '24h' ? saved.clockFormat : '24h'
        return {
          ...current,
          wallpaperId,
          customWallpaperUrl: custom,
          wallpaperGallery: gallery,
          showIconLabels: saved?.showIconLabels !== false,
          iconSize,
          uiScale,
          hidePlaceholderIcons: saved?.hidePlaceholderIcons === true,
          showTaskbarClock: saved?.showTaskbarClock !== false,
          clockFormat,
          showTrayDecor: saved?.showTrayDecor !== false,
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

if (isClient) {
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
