import type { DesktopAppId, DesktopCoordinate, DesktopWindowRuntime } from '@/config/desktop'
import type { WallpaperId } from '@/config/wallpapers'
import type { UiScale } from '@/lib/uiScale'
import { STORAGE_KEYS, type StorageKey } from './keys'

/** Zustand persist 写入形态 */
export type ZustandPersistEnvelope<TState> = {
  state: TState
  version?: number
}

/** next-themes 存的是纯字符串，不是 JSON */
export type ThemeStorageValue = 'light' | 'dark'

/** 与 store/settings 的 WallpaperGalleryItem 对齐（避免循环依赖） */
export type SettingsGalleryItemPersist = {
  id: string
  url: string
  thumbUrl?: string
  name?: string
  createdAt: number
}

export type SettingsPersistState = {
  wallpaperId: WallpaperId
  customWallpaperUrl: string | null
  wallpaperGallery: SettingsGalleryItemPersist[]
  showIconLabels: boolean
  iconSize: 'sm' | 'md' | 'lg'
  uiScale: UiScale
  hidePlaceholderIcons: boolean
  showTaskbarClock: boolean
  clockFormat: '24h' | '12h'
  showTrayDecor: boolean
  /** 应用窗口默认最大化打开 */
  openWindowsMaximized: boolean
}

export type WindowsPersistState = {
  windows: Record<DesktopAppId, DesktopWindowRuntime>
  topZIndex: number
  nextOpenOrder?: number
}

export type CoordinatesPersistState = {
  coordinates: Record<DesktopAppId, DesktopCoordinate>
}

export type NotepadPersistState = {
  lastNoteId: string | null
  wordWrap: boolean
}

export type PaintToolPersist = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse'

export type PaintPersistState = {
  lastDrawingId: string | null
  tool: PaintToolPersist
  color: string
  brushSize: number
}

/** 壁纸首屏 boot 标记 */
export type WallpaperBootPersist = {
  wallpaperId: WallpaperId
  customUrl?: string
}

/** 旧版桌面合一 persist（仅迁移读取） */
export type LegacyDesktopPersistState = {
  apps?: Array<{
    id: DesktopAppId
    isOpen?: boolean
    minimized?: boolean
    active?: boolean
    zIndex?: number
    coordinate?: DesktopCoordinate
  }>
  topZIndex?: number
}

export type LockPersistState = {
  isLocked: boolean
  sessionHash: string | null
}

/**
 * 每个 key 对应的「语义值」类型。
 * - theme：纯字符串
 * - 其余：JSON（zustand 为 envelope；boot 为对象本身）
 */
export type StorageSchema = {
  [STORAGE_KEYS.theme]: ThemeStorageValue
  [STORAGE_KEYS.settings]: ZustandPersistEnvelope<SettingsPersistState>
  [STORAGE_KEYS.windows]: ZustandPersistEnvelope<WindowsPersistState>
  [STORAGE_KEYS.coordinates]: ZustandPersistEnvelope<CoordinatesPersistState>
  [STORAGE_KEYS.legacyDesktop]: ZustandPersistEnvelope<LegacyDesktopPersistState>
  [STORAGE_KEYS.wallpaperBoot]: WallpaperBootPersist
  [STORAGE_KEYS.notepad]: ZustandPersistEnvelope<NotepadPersistState>
  [STORAGE_KEYS.paint]: ZustandPersistEnvelope<PaintPersistState>
  [STORAGE_KEYS.lock]: ZustandPersistEnvelope<LockPersistState>
}

/** 以 JSON 读写的 key（不含 theme） */
export type JsonStorageKey = Exclude<StorageKey, typeof STORAGE_KEYS.theme>
