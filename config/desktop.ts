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
  Settings,
} from 'lucide-react'
import { Minesweeper } from '@/games/minesweeper'
import { Tetris } from '@/games/tetris'
import { apps } from '@/messages/zh-CN.json'

export type DesktopAppId = keyof typeof apps
export type DesktopCoordinate = [number, number]

/** 静态定义：图标、默认格点、窗口组件等（不进 persist） */
export interface DesktopAppDefinition {
  id: DesktopAppId
  icon: ComponentType<{ className?: string; size?: number }>
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
  { id: 'document', icon: BookOpenText, defaultCoordinate: [2, 3] },
  { id: 'donation', icon: Rose, defaultCoordinate: [2, 4] },
  { id: 'email', icon: Mail, defaultCoordinate: [2, 5] },
  { id: 'log', icon: Notebook, defaultCoordinate: [2, 6] },
  { id: 'settings', icon: Settings, defaultCoordinate: [2, 7] },
]

const definitionMap = new Map(DESKTOP_APP_DEFINITIONS.map((app) => [app.id, app]))

export function getAppDefinition(id: DesktopAppId): DesktopAppDefinition | undefined {
  return definitionMap.get(id)
}

export function createDefaultWindows(): Record<DesktopAppId, DesktopWindowRuntime> {
  return Object.fromEntries(
    DESKTOP_APP_DEFINITIONS.map((app) => [app.id, { ...DEFAULT_WINDOW_RUNTIME }]),
  ) as Record<DesktopAppId, DesktopWindowRuntime>
}

export function createDefaultCoordinates(): Record<DesktopAppId, DesktopCoordinate> {
  return Object.fromEntries(
    DESKTOP_APP_DEFINITIONS.map((app) => [app.id, [...app.defaultCoordinate] as DesktopCoordinate]),
  ) as Record<DesktopAppId, DesktopCoordinate>
}
