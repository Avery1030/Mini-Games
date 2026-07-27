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
import { isClient } from '@/lib/env'
import { isUiScale, type UiScale } from '@/lib/uiScale'
import {
  DEFAULT_SCREENSAVER_STYLE,
  isScreensaverStyleId,
  normalizeScreensaverStyleId,
  type ScreensaverStyleId,
} from '@/config/screensavers'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

export type { ScreensaverStyleId } from '@/config/screensavers'
export {
  SCREENSAVER_STYLE_OPTIONS,
  DEFAULT_SCREENSAVER_STYLE,
  isScreensaverStyleId,
  normalizeScreensaverStyleId,
} from '@/config/screensavers'

const MAX_GALLERY = 40

/**
 * 屏保空闲超时（分钟）。
 * `0` 表示永不自动启动（见 screensaverIdleToMs）。
 */
export const SCREENSAVER_IDLE_OPTIONS = [1, 5, 10, 15, 30, 0] as const
export type ScreensaverIdleMinutes = (typeof SCREENSAVER_IDLE_OPTIONS)[number]

export function isScreensaverIdleMinutes(v: unknown): v is ScreensaverIdleMinutes {
  return SCREENSAVER_IDLE_OPTIONS.includes(v as ScreensaverIdleMinutes)
}

/** 将屏保空闲选项转为毫秒；`0`（永不）→ 0，使 idle 监听不启动 */
export function screensaverIdleToMs(minutes: ScreensaverIdleMinutes): number {
  if (minutes === 0) return 0
  return minutes * 60_000
}

export type WallpaperGalleryItem = {
  id: string
  /** 原图 CDN，用于桌面 */
  url: string
  /** 缩略图（可选） */
  thumbUrl?: string
  name?: string
  createdAt: number
}

const settingsStorage = appStorage.createStateStorage()

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
  /** 应用窗口默认最大化打开 */
  openWindowsMaximized: boolean
  /** 是否启用屏幕保护 */
  screensaverEnabled: boolean
  /** 无操作多久后启动屏保（分钟；0 = 临时 10 秒） */
  screensaverIdleMinutes: ScreensaverIdleMinutes
  /** 当前应用的屏保视觉样式 */
  screensaverStyle: ScreensaverStyleId
  _hasHydrated: boolean
}

interface SettingsActions {
  setHasHydrated: (value: boolean) => void
  /** 批量/单字段更新可序列化设置（含枚举校验） */
  patch: (partial: SettingsPatch) => void
  applyWallpaper: (wallpaperId: WallpaperId, customUrl?: string | null) => void
  addToWallpaperGallery: (item: Omit<WallpaperGalleryItem, 'id' | 'createdAt'> & { id?: string }) => void
  removeFromWallpaperGallery: (id: string) => void
  clearCustomWallpaper: () => void
}

/** 允许通过 patch 写入的字段（不含壁纸事务与 hydration） */
export type SettingsPatch = Partial<
  Pick<
    SettingsState,
    | 'showIconLabels'
    | 'iconSize'
    | 'uiScale'
    | 'hidePlaceholderIcons'
    | 'showTaskbarClock'
    | 'clockFormat'
    | 'openWindowsMaximized'
    | 'screensaverEnabled'
    | 'screensaverIdleMinutes'
    | 'screensaverStyle'
  >
>

/** 设置字段枚举校验与清理 */
function sanitizeSettingsPatch(partial: SettingsPatch): SettingsPatch {
  const next: SettingsPatch = { ...partial }
  if (next.iconSize != null && next.iconSize !== 'sm' && next.iconSize !== 'md' && next.iconSize !== 'lg') {
    delete next.iconSize
  }
  if (next.uiScale != null && !isUiScale(next.uiScale)) {
    delete next.uiScale
  }
  if (next.clockFormat != null && next.clockFormat !== '12h' && next.clockFormat !== '24h') {
    delete next.clockFormat
  }
  if (next.screensaverIdleMinutes != null && !isScreensaverIdleMinutes(next.screensaverIdleMinutes)) {
    delete next.screensaverIdleMinutes
  }
  if (next.screensaverStyle != null && !isScreensaverStyleId(next.screensaverStyle)) {
    delete next.screensaverStyle
  }
  return next
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
      openWindowsMaximized: false,
      screensaverEnabled: false,
      screensaverIdleMinutes: 5,
      screensaverStyle: DEFAULT_SCREENSAVER_STYLE,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      patch: (partial) => {
        const next = sanitizeSettingsPatch(partial)
        if (Object.keys(next).length === 0) return
        set(next)
      },

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
        if (!isValidCustomWallpaperSrc(item.url) || item.url.startsWith('data:') || item.url.startsWith('blob:')) {
          return
        }
        set((state) => {
          const withoutDup = state.wallpaperGallery.filter((g) => g.url !== item.url)
          const thumb =
            item.thumbUrl &&
            isValidCustomWallpaperSrc(item.thumbUrl) &&
            !item.thumbUrl.startsWith('data:') &&
            !item.thumbUrl.startsWith('blob:')
              ? item.thumbUrl
              : undefined
          const next: WallpaperGalleryItem = {
            id: item.id ?? `wp-${Date.now()}`,
            url: item.url,
            thumbUrl: thumb,
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
      version: 19,
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
        openWindowsMaximized: state.openWindowsMaximized,
        screensaverEnabled: state.screensaverEnabled,
        screensaverIdleMinutes: state.screensaverIdleMinutes,
        screensaverStyle: state.screensaverStyle,
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
          openWindowsMaximized?: unknown
          screensaverEnabled?: unknown
          screensaverIdleMinutes?: unknown
          screensaverStyle?: unknown
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
        const screensaverIdleMinutes = isScreensaverIdleMinutes(raw.screensaverIdleMinutes)
          ? raw.screensaverIdleMinutes
          : 5
        const screensaverStyle = normalizeScreensaverStyleId(raw.screensaverStyle)
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
          openWindowsMaximized: raw.openWindowsMaximized !== false,
          screensaverEnabled: raw.screensaverEnabled === true,
          screensaverIdleMinutes,
          screensaverStyle,
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
              openWindowsMaximized?: unknown
              screensaverEnabled?: unknown
              screensaverIdleMinutes?: unknown
              screensaverStyle?: unknown
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
        const screensaverIdleMinutes = isScreensaverIdleMinutes(saved?.screensaverIdleMinutes)
          ? saved.screensaverIdleMinutes
          : 5
        const screensaverStyle = normalizeScreensaverStyleId(saved?.screensaverStyle)
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
          openWindowsMaximized: saved?.openWindowsMaximized !== false,
          screensaverEnabled: saved?.screensaverEnabled === true,
          screensaverIdleMinutes,
          screensaverStyle,
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

/** 事件回调里改设置，无需在组件顶层订阅 action */
export function patchSettings(partial: SettingsPatch) {
  useSettingsStore.getState().patch(partial)
}

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
