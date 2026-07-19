import type { ComponentType } from 'react'
import {
  UserPlus,
  Castle,
  Gift,
  ChartColumnBig,
  Store,
  Gamepad,
  Gamepad2,
  Building2,
  Wrench,
  BookOpenText,
  Rose,
  Mail,
  Notebook,
  FileText,
  Palette,
  Settings,
  Music,
} from 'lucide-react'
import { Minesweeper } from '@/features/minesweeper'
import { Tetris } from '@/features/tetris'
import { Music as MusicApp } from '@/features/music'
import { SettingsApp } from '@/features/settings'
import { DocumentApp } from '@/features/document'
import { LogApp } from '@/features/log'
import { NotepadApp } from '@/features/notepad'
import { PaintApp } from '@/features/paint'
import { apps } from '@/messages/zh-CN.json'

export type DesktopAppId = keyof typeof apps
export type DesktopCoordinate = [number, number]

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
}

export const DESKTOP_APP_DEFINITIONS: DesktopAppDefinition[] = [
  { id: 'referral', icon: UserPlus, defaultCoordinate: [1, 1] },
  { id: 'bridge', icon: Castle, defaultCoordinate: [1, 2] },
  { id: 'claim', icon: Gift, defaultCoordinate: [1, 3] },
  { id: 'stake', icon: ChartColumnBig, defaultCoordinate: [1, 4] },
  { id: 'market', icon: Store, defaultCoordinate: [1, 5] },
  {
    id: 'minesweeper',
    icon: Gamepad,
    defaultCoordinate: [1, 6],
    width: 520,
    height: 520,
    app: Minesweeper,
  },
  {
    id: 'tetris',
    icon: Gamepad2,
    defaultCoordinate: [1, 7],
    width: 560,
    height: 640,
    app: Tetris,
  },
  { id: 'governance', icon: Building2, defaultCoordinate: [2, 1] },
  { id: 'foundry', icon: Wrench, defaultCoordinate: [2, 2] },
  {
    id: 'document',
    icon: BookOpenText,
    defaultCoordinate: [2, 3],
    width: 520,
    height: 420,
    app: DocumentApp,
  },
  { id: 'donation', icon: Rose, defaultCoordinate: [2, 4] },
  { id: 'email', icon: Mail, defaultCoordinate: [2, 5] },
  {
    id: 'log',
    icon: Notebook,
    defaultCoordinate: [2, 6],
    width: 520,
    height: 420,
    app: LogApp,
  },
  {
    id: 'notepad',
    icon: FileText,
    defaultCoordinate: [3, 1],
    width: 560,
    height: 460,
    app: NotepadApp,
  },
  {
    id: 'paint',
    icon: Palette,
    defaultCoordinate: [3, 2],
    width: 720,
    height: 560,
    app: PaintApp,
  },
  {
    id: 'settings',
    icon: Settings,
    defaultCoordinate: [2, 7],
    width: 560,
    height: 520,
    app: SettingsApp,
  },
  {
    id: 'music',
    icon: Music,
    defaultCoordinate: [2, 8],
    width: 420,
    height: 620,
    app: MusicApp,
  },
]

const definitionMap = new Map(DESKTOP_APP_DEFINITIONS.map((app) => [app.id, app]))

export function getAppDefinition(id: DesktopAppId): DesktopAppDefinition | undefined {
  return definitionMap.get(id)
}

export function createDefaultWindows(): Record<DesktopAppId, DesktopWindowRuntime> {
  return Object.fromEntries(DESKTOP_APP_DEFINITIONS.map((app) => [app.id, { ...DEFAULT_WINDOW_RUNTIME }])) as Record<
    DesktopAppId,
    DesktopWindowRuntime
  >
}

export function createDefaultCoordinates(): Record<DesktopAppId, DesktopCoordinate> {
  return Object.fromEntries(
    DESKTOP_APP_DEFINITIONS.map((app) => [app.id, [...app.defaultCoordinate] as DesktopCoordinate]),
  ) as Record<DesktopAppId, DesktopCoordinate>
}
