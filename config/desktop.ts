import type { ComponentType } from 'react'
import type { Locale } from '@/i18n/config'

/** 内置应用 id（与 builtins 注册表一一对应） */
export enum BuiltinAppId {
  Games = 'games',
  Minesweeper = 'minesweeper',
  Suika = 'suika',
  ImagePuzzle = 'imagePuzzle',
  CanvasJigsaw = 'canvasJigsaw',
  Sokoban = 'sokoban',
  Sudoku = 'sudoku',
  Spider = 'spider',
  Document = 'document',
  Log = 'log',
  Notepad = 'notepad',
  Ide = 'ide',
  Paint = 'paint',
  Settings = 'settings',
  Calculator = 'calculator',
  RecycleBin = 'recycleBin',
  Cmd = 'cmd',
  KlineChartViewer = 'klineChartViewer',
  AiChat = 'aiChat',
  TaskManager = 'taskManager',
  ImageViewer = 'imageViewer',
  FileExplorer = 'fileExplorer',
  Writer = 'writer',
  Sheet = 'sheet',
}

/** 收纳进「游戏」集合的内置小游戏 id（顺序即列表展示顺序）。清单已冻结，勿再新增。 */
export const GAME_APP_IDS: readonly BuiltinAppId[] = [
  BuiltinAppId.Minesweeper,
  BuiltinAppId.Suika,
  BuiltinAppId.ImagePuzzle,
  BuiltinAppId.CanvasJigsaw,
  BuiltinAppId.Sokoban,
  BuiltinAppId.Sudoku,
  BuiltinAppId.Spider,
]

/**
 * 桌面图标 / 窗口 id。
 * 内置为 BuiltinAppId；动态项（如文件夹）为运行时字符串（folder_xxx）。
 */
export type DesktopAppId = BuiltinAppId | string

/** 应用标题多语言（与 i18n Locale 对齐） */
export type AppLocale = Locale
export type AppTitles = Partial<Record<AppLocale, string>>

export type DesktopCoordinate = [number, number]

/** 桌面图标默认每列个数（从上到下、再从左到右） */
export const DESKTOP_ICON_ROWS = 8

export function desktopIconCoordinate(index: number, rows = DESKTOP_ICON_ROWS): DesktopCoordinate {
  const n = Math.max(1, rows)
  return [Math.floor(index / n) + 1, (index % n) + 1]
}

export type DesktopItemKind = 'app' | 'folder' | 'textDocument'

/** 窗口铬行为：子类可通过 DesktopWindow.chrome 覆盖 */
export type WindowChromeOptions = {
  draggable: boolean
  resizable: boolean
  minimizable: boolean
  maximizable: boolean
}

/** 静态定义：图标、默认格点、窗口组件等（不进 persist） */
export interface DesktopAppDefinition {
  id: DesktopAppId
  icon: ComponentType<{
    className?: string
    size?: number
    strokeWidth?: number
    absoluteStrokeWidth?: boolean
  }>
  defaultCoordinate: DesktopCoordinate
  /** 有 app 组件的图标才能打开窗口 */
  app?: ComponentType
  width?: number
  height?: number
  chrome?: WindowChromeOptions
  /** 运行时标题；有则优先于 titles / i18n `apps.*` */
  title?: string
  /** 多语言标题（registerBuiltinApp 写入） */
  titles?: AppTitles
  kind?: DesktopItemKind
  /** 是否出现在开始菜单「程序」里；文件夹默认 false */
  showInStartMenu?: boolean
  /** 是否出现在桌面图标层；默认 true（命令提示符等可设为 false） */
  showOnDesktop?: boolean
}

/** 窗口上次正常态几何（最大化时仍记还原用坐标/宽高） */
export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
  /** 关闭/记忆时是否处于最大化 */
  maximized: boolean
}

/** 窗口运行时状态（可序列化） */
export interface DesktopWindowRuntime {
  isOpen: boolean
  minimized: boolean
  active: boolean
  /** 窗口叠放层级，数值越大越靠前 */
  zIndex: number
  /** 任务栏从左到右顺序：越大越靠右（越晚打开）；关闭为 0 */
  openOrder: number
  /** 上次打开的位置与尺寸；关闭后保留，供下次恢复 */
  bounds: Nullable<WindowBounds>
}

/** UI 合并视图：定义 + 坐标 + 窗口状态 */
export type DesktopAppView = DesktopAppDefinition &
  DesktopWindowRuntime & {
    coordinate: DesktopCoordinate
  }

export const DEFAULT_WINDOW_RUNTIME: DesktopWindowRuntime = {
  isOpen: false,
  minimized: false,
  active: false,
  zIndex: 0,
  openOrder: 0,
  bounds: null,
}

export const DEFAULT_WINDOW_CHROME: WindowChromeOptions = {
  draggable: true,
  resizable: true,
  minimizable: true,
  maximizable: true,
}
