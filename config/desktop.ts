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

export interface DesktopAppConfig {
  id: DesktopAppId
  icon: ComponentType<{ className?: string; size?: number }>
  coordinate: [number, number]
  /** 有 app 组件的图标才能打开窗口 */
  app?: ComponentType<{ embedded?: boolean }>
  width?: number
  height?: number
  isOpen: boolean
  minimized: boolean
  active: boolean
  /** 窗口叠放层级，数值越大越靠前 */
  zIndex: number
}

/** 仅可序列化的窗口状态，用于 persist */
export type DesktopAppWindowState = Pick<
  DesktopAppConfig,
  'id' | 'isOpen' | 'minimized' | 'active' | 'zIndex'
>

const DEFAULT_WINDOW_STATE = {
  isOpen: false,
  minimized: false,
  active: false,
  zIndex: 0,
} as const

export const DESKTOP_APPS: DesktopAppConfig[] = [
  { id: 'referral', icon: UserPlus, coordinate: [1, 1], ...DEFAULT_WINDOW_STATE },
  { id: 'bridge', icon: Castle, coordinate: [1, 2], ...DEFAULT_WINDOW_STATE },
  { id: 'claim', icon: Gift, coordinate: [1, 3], ...DEFAULT_WINDOW_STATE },
  { id: 'stake', icon: ChartColumnBig, coordinate: [1, 4], ...DEFAULT_WINDOW_STATE },
  { id: 'market', icon: Store, coordinate: [1, 5], ...DEFAULT_WINDOW_STATE },
  {
    id: 'minesweeper',
    icon: Gamepad,
    coordinate: [1, 6],
    width: 520,
    height: 520,
    app: Minesweeper,
    ...DEFAULT_WINDOW_STATE,
  },
  {
    id: 'tetris',
    icon: Gamepad2,
    coordinate: [1, 7],
    width: 560,
    height: 640,
    app: Tetris,
    ...DEFAULT_WINDOW_STATE,
  },
  { id: 'governance', icon: Building2, coordinate: [2, 1], ...DEFAULT_WINDOW_STATE },
  { id: 'foundry', icon: Wrench, coordinate: [2, 2], ...DEFAULT_WINDOW_STATE },
  { id: 'document', icon: BookOpenText, coordinate: [2, 3], ...DEFAULT_WINDOW_STATE },
  { id: 'donation', icon: Rose, coordinate: [2, 4], ...DEFAULT_WINDOW_STATE },
  { id: 'email', icon: Mail, coordinate: [2, 5], ...DEFAULT_WINDOW_STATE },
  { id: 'log', icon: Notebook, coordinate: [2, 6], ...DEFAULT_WINDOW_STATE },
  { id: 'settings', icon: Settings, coordinate: [2, 7], ...DEFAULT_WINDOW_STATE },
]

/** 用持久化状态合并静态配置（icon/app 无法序列化） */
export function mergeDesktopApps(saved?: DesktopAppWindowState[]): DesktopAppConfig[] {
  const stateMap = new Map(saved?.map((s) => [s.id, s]))
  return DESKTOP_APPS.map((app) => {
    const state = stateMap.get(app.id)
    if (!state) return { ...app }
    return {
      ...app,
      isOpen: state.isOpen,
      minimized: state.minimized,
      active: state.active,
      zIndex: state.zIndex ?? 0,
    }
  })
}
