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

export type WallpaperFitModePersist = 'tile' | 'cover' | 'center' | 'stretch'

export type SettingsPersistState = {
  wallpaperId: WallpaperId
  /** 当前自定义壁纸 VFS/public 路径 */
  wallpaperPath: Nullable<string>
  wallpaperFit: WallpaperFitModePersist
  wallpaper3dEnabled: boolean
  wallpaper3dPath: Nullable<string>
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
  lastNoteId: Nullable<string>
  wordWrap: boolean
}

export type PaintToolPersist = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse'

export type PaintPersistState = {
  lastDrawingId: Nullable<string>
  tool: PaintToolPersist
  color: string
  brushSize: number
}

export type KlineChartPersistState = {
  symbol: string
  interval: string
  overlays: string[]
  panes: string[]
}

/** 壁纸首屏 boot 标记 */
export type WallpaperBootPersist = {
  wallpaperId: WallpaperId
  wallpaperPath?: string
  wallpaperFit?: WallpaperFitModePersist
  wallpaper3dEnabled?: boolean
  wallpaper3dPath?: string
}

export type LockPersistState = {
  isLocked: boolean
  sessionHash: Nullable<string>
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
  parentId?: Nullable<string>
  /** 软删除：进入回收站后为 true，不从持久化中移除 */
  isDeleted?: boolean
  deletedAt?: number
  /** 删除前桌面坐标，还原时优先尝试 */
  deletedFromCoordinate?: DesktopCoordinate
}

export type DesktopItemsPersistState = {
  items: DesktopItemPersist[]
}

export type IdeSessionPersist = {
  id: string
  filePath: Nullable<string>
  title: string
}

export type IdeSessionsPersistState = {
  sessions: IdeSessionPersist[]
}

export type OfficeSessionWindowPersist = {
  id: string
  kind: OfficeKindPersist
  fileId: Nullable<string>
  title: string
}

export type OfficeSessionsPersistState = {
  sessions: OfficeSessionWindowPersist[]
}

export type ExplorerSessionPersist = {
  id: string
  path: string
  title: string
}

export type ExplorerSessionsPersistState = {
  sessions: ExplorerSessionPersist[]
}

export type OfficeKindPersist = 'writer' | 'sheet'

export type OfficeFilePersist = {
  id: string
  name: string
  kind: OfficeKindPersist
  updatedAt: number
  writer?: { html: string }
  sheet?: { cols: number; rows: number; cells: Record<string, string> }
}

export type OfficePersistState = {
  files: OfficeFilePersist[]
  lastWriterId: Nullable<string>
  lastSheetId: Nullable<string>
}

/**
 * 每个 key 对应的「语义值」类型。
 * - theme / suikaBest / ideFormatOnSave / split*：纯字符串
 * - fireworks：JSON 对象
 * - 其余：JSON（zustand 为 envelope；boot 为对象本身）
 */
export type StorageSchema = {
  [STORAGE_KEYS.theme]: ThemeStorageValue
  [STORAGE_KEYS.settings]: ZustandPersistEnvelope<SettingsPersistState>
  [STORAGE_KEYS.windows]: ZustandPersistEnvelope<WindowsPersistState>
  [STORAGE_KEYS.coordinates]: ZustandPersistEnvelope<CoordinatesPersistState>
  [STORAGE_KEYS.wallpaperBoot]: WallpaperBootPersist
  [STORAGE_KEYS.notepad]: ZustandPersistEnvelope<NotepadPersistState>
  [STORAGE_KEYS.paint]: ZustandPersistEnvelope<PaintPersistState>
  [STORAGE_KEYS.klineChart]: ZustandPersistEnvelope<KlineChartPersistState>
  [STORAGE_KEYS.sokoban]: ZustandPersistEnvelope<{
    levels: Record<string, { stars: number; bestMoves: number }>
  }>
  [STORAGE_KEYS.sudoku]: ZustandPersistEnvelope<{
    levels: Record<string, { bestTime: number }>
    settings: {
      smartHints: boolean
      hideUsedDigits: boolean
      highlightUnique: boolean
      highlightSameNotes: boolean
      highlightSameDigits: boolean
      highlightRegions: boolean
      autoUndoWrong: boolean
      autoClearNotes: boolean
    }
  }>
  [STORAGE_KEYS.spider]: ZustandPersistEnvelope<{
    difficulty: 1 | 2 | 3 | 4
    state: unknown
    undoStack: unknown[]
    elapsed: number
    records: Record<
      '1' | '2' | '3' | '4',
      Array<{ elapsed: number; moves: number; score: number; at: number }>
    >
    winLogged: boolean
  }>
  [STORAGE_KEYS.lock]: ZustandPersistEnvelope<LockPersistState>
  [STORAGE_KEYS.calendar]: ZustandPersistEnvelope<CalendarPersistState>
  [STORAGE_KEYS.desktopItems]: ZustandPersistEnvelope<DesktopItemsPersistState>
  [STORAGE_KEYS.ideSessions]: IdeSessionsPersistState
  [STORAGE_KEYS.officeSessions]: OfficeSessionsPersistState
  [STORAGE_KEYS.explorerSessions]: ExplorerSessionsPersistState
  [STORAGE_KEYS.vfsCatalog]: ZustandPersistEnvelope<{ items: Record<string, unknown> }>
  [STORAGE_KEYS.office]: ZustandPersistEnvelope<OfficePersistState>
  /** 原始数字字符串，如 `"1280"` */
  [STORAGE_KEYS.suikaBest]: string
  /** `'1'` | `'0'`，缺省视为开启 */
  [STORAGE_KEYS.ideFormatOnSave]: '0' | '1'
  /** 分栏宽度（像素字符串） */
  [STORAGE_KEYS.splitNotepad]: string
  [STORAGE_KEYS.splitPaint]: string
  [STORAGE_KEYS.splitDocument]: string
  [STORAGE_KEYS.splitLog]: string
  [STORAGE_KEYS.splitSettings]: string
  [STORAGE_KEYS.splitAiChat]: string
  [STORAGE_KEYS.splitImageViewer]: string
  [STORAGE_KEYS.splitFileExplorer]: string
  /** 烟花屏保 iframe 偏好 JSON */
  [STORAGE_KEYS.fireworks]: unknown
}

/** 以 JSON 读写的 key（不含纯字符串 key） */
export type JsonStorageKey = Exclude<
  StorageKey,
  | typeof STORAGE_KEYS.theme
  | typeof STORAGE_KEYS.suikaBest
  | typeof STORAGE_KEYS.ideFormatOnSave
  | typeof STORAGE_KEYS.splitNotepad
  | typeof STORAGE_KEYS.splitPaint
  | typeof STORAGE_KEYS.splitDocument
  | typeof STORAGE_KEYS.splitLog
  | typeof STORAGE_KEYS.splitSettings
  | typeof STORAGE_KEYS.splitAiChat
  | typeof STORAGE_KEYS.splitImageViewer
  | typeof STORAGE_KEYS.splitFileExplorer
>
