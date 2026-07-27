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
  /** 应用窗口默认最大化打开 */
  openWindowsMaximized: boolean
  screensaverEnabled: boolean
  /** `0` = 永不自动启动 */
  screensaverIdleMinutes: 0 | 1 | 5 | 10 | 15 | 30
  screensaverStyle: 'fireworks'
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

export type KlineChartPersistState = {
  symbol: string
  interval: string
  overlays: string[]
  panes: string[]
  drawingToolbarCollapsed: boolean
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

/** 日历按日备注：key 为 yyyy-MM-dd */
export type CalendarPersistState = {
  notes: Record<string, string>
}

export type DesktopItemPersist = {
  id: string
  kind: 'folder' | 'textDocument'
  title: string
  createdAt: number
  noteId?: string
  /** null = 桌面根；否则为父文件夹 id */
  parentId?: string | null
  /** 软删除：进入回收站后为 true，不从持久化中移除 */
  isDeleted?: boolean
  deletedAt?: number
  /** 删除前桌面坐标，还原时优先尝试 */
  deletedFromCoordinate?: DesktopCoordinate
}

/** @deprecated 使用 DesktopItemPersist */
export type DesktopFolderPersist = DesktopItemPersist

export type DesktopItemsPersistState = {
  items: DesktopItemPersist[]
  /** @deprecated v3 及更早；merge 时迁移到 items */
  folders?: DesktopFolderPersist[]
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
  [STORAGE_KEYS.klineChart]: ZustandPersistEnvelope<KlineChartPersistState>
  [STORAGE_KEYS.lock]: ZustandPersistEnvelope<LockPersistState>
  [STORAGE_KEYS.calendar]: ZustandPersistEnvelope<CalendarPersistState>
  [STORAGE_KEYS.desktopItems]: ZustandPersistEnvelope<DesktopItemsPersistState>
}

/** 以 JSON 读写的 key（不含 theme） */
export type JsonStorageKey = Exclude<StorageKey, typeof STORAGE_KEYS.theme>
