import { LayoutGrid } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 打开：useWindowStore.getState().openWindow('match3')
 * 收纳进「游戏」：features/games/ids.ts → GAME_APP_IDS
 */
registerBuiltinApp({
  id: 'match3',
  icon: LayoutGrid,
  defaultCoordinate: [1, 3],
  width: 420,
  height: 620,
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Match3 } = require('@/features/match3') as typeof import('@/features/match3')
    return Match3
  },
})
