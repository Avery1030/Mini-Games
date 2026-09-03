import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  CUSTOM_WALLPAPER_ID,
  DEFAULT_WALLPAPER_FIT,
  DEFAULT_WALLPAPER_ID,
  isValidCustomWallpaperSrc,
  isWallpaperFitMode,
  isWallpaperId,
  type WallpaperFitMode,
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

const settingsStorage = appStorage.createStateStorage()

function normalizeWallpaperPath(raw: unknown): Nullable<string> {
  return isValidCustomWallpaperSrc(raw) ? raw : null
}

function syncWallpaperBoot(state: {
  wallpaperId: WallpaperId
  wallpaperPath: Nullable<string>
  wallpaperFit: WallpaperFitMode
  wallpaper3dEnabled: boolean
  wallpaper3dPath: Nullable<string>
}) {
  writeWallpaperBoot({
    wallpaperId: state.wallpaperId,
    wallpaperPath: state.wallpaperPath,
    wallpaperFit: state.wallpaperFit,
    wallpaper3dEnabled: state.wallpaper3dEnabled,
    wallpaper3dPath: state.wallpaper3dPath,
  })
}

interface SettingsState {
  wallpaperId: WallpaperId
  /** 自定义静态壁纸路径（VFS `/Wallpapers/…` 或 public） */
  wallpaperPath: Nullable<string>
  wallpaperFit: WallpaperFitMode
  wallpaper3dEnabled: boolean
  wallpaper3dPath: Nullable<string>
  showIconLabels: boolean
  iconSize: 'sm' | 'md' | 'lg'
  uiScale: UiScale
  hidePlaceholderIcons: boolean
  showTaskbarClock: boolean
  clockFormat: '24h' | '12h'
  openWindowsMaximized: boolean
  screensaverEnabled: boolean
  screensaverIdleMinutes: ScreensaverIdleMinutes
  screensaverStyle: ScreensaverStyleId
  _hasHydrated: boolean
}

interface SettingsActions {
  setHasHydrated: (value: boolean) => void
  patch: (partial: SettingsPatch) => void
  applyWallpaper: (input: {
    wallpaperId: WallpaperId
    wallpaperPath?: Nullable<string>
    wallpaperFit?: WallpaperFitMode
    wallpaper3dEnabled?: boolean
    wallpaper3dPath?: Nullable<string>
  }) => void
  setWallpaperFit: (fit: WallpaperFitMode) => void
  clearCustomWallpaper: () => void
}

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

function parsePersistedWallpaper(raw: {
  wallpaperId?: unknown
  wallpaperPath?: unknown
  wallpaperFit?: unknown
  wallpaper3dEnabled?: unknown
  wallpaper3dPath?: unknown
}): Pick<
  SettingsState,
  'wallpaperId' | 'wallpaperPath' | 'wallpaperFit' | 'wallpaper3dEnabled' | 'wallpaper3dPath'
> {
  const path = normalizeWallpaperPath(raw.wallpaperPath)
  let wallpaperId = isWallpaperId(raw.wallpaperId) ? raw.wallpaperId : DEFAULT_WALLPAPER_ID
  if (wallpaperId === CUSTOM_WALLPAPER_ID && !path) {
    wallpaperId = DEFAULT_WALLPAPER_ID
  }
  return {
    wallpaperId,
    wallpaperPath: path,
    wallpaperFit: isWallpaperFitMode(raw.wallpaperFit) ? raw.wallpaperFit : DEFAULT_WALLPAPER_FIT,
    wallpaper3dEnabled: raw.wallpaper3dEnabled === true,
    wallpaper3dPath: normalizeWallpaperPath(raw.wallpaper3dPath),
  }
}

export type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      wallpaperId: DEFAULT_WALLPAPER_ID,
      wallpaperPath: null,
      wallpaperFit: DEFAULT_WALLPAPER_FIT,
      wallpaper3dEnabled: false,
      wallpaper3dPath: null,
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

      applyWallpaper: (input) => {
        if (!isWallpaperId(input.wallpaperId)) return
        const prev = get()
        const wallpaperFit =
          input.wallpaperFit !== undefined && isWallpaperFitMode(input.wallpaperFit)
            ? input.wallpaperFit
            : prev.wallpaperFit
        const wallpaper3dEnabled =
          input.wallpaper3dEnabled !== undefined ? Boolean(input.wallpaper3dEnabled) : prev.wallpaper3dEnabled
        const wallpaper3dPath =
          input.wallpaper3dPath !== undefined
            ? normalizeWallpaperPath(input.wallpaper3dPath)
            : prev.wallpaper3dPath

        if (input.wallpaperId === CUSTOM_WALLPAPER_ID) {
          const path = normalizeWallpaperPath(input.wallpaperPath ?? prev.wallpaperPath)
          if (!path) return
          const next = {
            wallpaperId: CUSTOM_WALLPAPER_ID as WallpaperId,
            wallpaperPath: path,
            wallpaperFit,
            wallpaper3dEnabled,
            wallpaper3dPath,
          }
          syncWallpaperBoot(next)
          set(next)
          return
        }

        const next = {
          wallpaperId: input.wallpaperId,
          wallpaperPath: prev.wallpaperPath,
          wallpaperFit,
          wallpaper3dEnabled,
          wallpaper3dPath,
        }
        syncWallpaperBoot(next)
        set({
          wallpaperId: input.wallpaperId,
          wallpaperFit,
          wallpaper3dEnabled,
          wallpaper3dPath,
        })
      },

      setWallpaperFit: (fit) => {
        if (!isWallpaperFitMode(fit)) return
        const state = get()
        const next = { ...state, wallpaperFit: fit }
        syncWallpaperBoot(next)
        set({ wallpaperFit: fit })
      },

      clearCustomWallpaper: () => {
        const { wallpaperId, wallpaperFit, wallpaper3dEnabled, wallpaper3dPath } = get()
        const nextId = wallpaperId === CUSTOM_WALLPAPER_ID ? DEFAULT_WALLPAPER_ID : wallpaperId
        const next = {
          wallpaperId: nextId,
          wallpaperPath: null as Nullable<string>,
          wallpaperFit,
          wallpaper3dEnabled,
          wallpaper3dPath,
        }
        syncWallpaperBoot(next)
        set({
          wallpaperPath: null,
          wallpaperId: nextId,
        })
      },
    }),
    {
      name: STORAGE_KEYS.settings,
      version: 21,
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        wallpaperId: state.wallpaperId,
        wallpaperPath: state.wallpaperPath,
        wallpaperFit: state.wallpaperFit,
        wallpaper3dEnabled: state.wallpaper3dEnabled,
        wallpaper3dPath: state.wallpaper3dPath,
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
      migrate: (persisted, fromVersion) => {
        const raw = (persisted ?? {}) as Record<string, unknown>
        const wp = parsePersistedWallpaper(raw)
        const iconSize = raw.iconSize === 'sm' || raw.iconSize === 'md' || raw.iconSize === 'lg' ? raw.iconSize : 'md'
        const uiScale = isUiScale(raw.uiScale) ? raw.uiScale : 'md'
        const clockFormat = raw.clockFormat === '12h' || raw.clockFormat === '24h' ? raw.clockFormat : '24h'
        const screensaverIdleMinutes = isScreensaverIdleMinutes(raw.screensaverIdleMinutes)
          ? raw.screensaverIdleMinutes
          : 5
        return {
          ...wp,
          showIconLabels: raw.showIconLabels !== false,
          iconSize,
          uiScale,
          hidePlaceholderIcons: raw.hidePlaceholderIcons === true,
          showTaskbarClock: raw.showTaskbarClock !== false,
          clockFormat,
          openWindowsMaximized: fromVersion >= 21 && raw.openWindowsMaximized === true,
          screensaverEnabled: raw.screensaverEnabled === true,
          screensaverIdleMinutes,
          screensaverStyle: normalizeScreensaverStyleId(raw.screensaverStyle),
        }
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Record<string, unknown>
        const wp = parsePersistedWallpaper(saved)
        const iconSize =
          saved.iconSize === 'sm' || saved.iconSize === 'md' || saved.iconSize === 'lg' ? saved.iconSize : 'md'
        const uiScale = isUiScale(saved.uiScale) ? saved.uiScale : 'md'
        const clockFormat = saved.clockFormat === '12h' || saved.clockFormat === '24h' ? saved.clockFormat : '24h'
        const screensaverIdleMinutes = isScreensaverIdleMinutes(saved.screensaverIdleMinutes)
          ? saved.screensaverIdleMinutes
          : 5
        return {
          ...current,
          ...wp,
          showIconLabels: saved.showIconLabels !== false,
          iconSize,
          uiScale,
          hidePlaceholderIcons: saved.hidePlaceholderIcons === true,
          showTaskbarClock: saved.showTaskbarClock !== false,
          clockFormat,
          openWindowsMaximized: saved.openWindowsMaximized === true,
          screensaverEnabled: saved.screensaverEnabled === true,
          screensaverIdleMinutes,
          screensaverStyle: normalizeScreensaverStyleId(saved.screensaverStyle),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        syncWallpaperBoot(state)
        state.setHasHydrated(true)
      },
    },
  ),
)

export function patchSettings(partial: SettingsPatch) {
  useSettingsStore.getState().patch(partial)
}

if (isClient) {
  const markHydrated = () => {
    const s = useSettingsStore.getState()
    if (!s._hasHydrated) {
      syncWallpaperBoot(s)
      useSettingsStore.setState({ _hasHydrated: true })
    }
  }
  useSettingsStore.persist.onFinishHydration(markHydrated)
  if (useSettingsStore.persist.hasHydrated()) {
    markHydrated()
  }
}
