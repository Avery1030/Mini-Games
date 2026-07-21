import type { ComponentType } from 'react'
import { apps } from '@/messages/zh-CN.json'

/** 内置应用 id（与 messages.apps 对齐） */
export type BuiltinAppId = keyof typeof apps

/**
 * 桌面图标 / 窗口 id。
 * 内置为 BuiltinAppId；动态项（如文件夹）为运行时字符串（folder_xxx）。
 */
export type DesktopAppId = BuiltinAppId | (string & {})

export type DesktopCoordinate = [number, number]

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
  app?: ComponentType<{ embedded?: boolean }>
  width?: number
  height?: number
  chrome?: WindowChromeOptions
  /** 运行时标题；有则优先于 i18n `apps.*` */
  title?: string
  kind?: DesktopItemKind
  /** 是否出现在开始菜单「程序」里；文件夹默认 false */
  showInStartMenu?: boolean
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
  bounds: WindowBounds | null
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

const BUILTIN_APP_IDS = new Set(Object.keys(apps))

export function isBuiltinAppId(id: string): id is BuiltinAppId {
  return BUILTIN_APP_IDS.has(id)
}
