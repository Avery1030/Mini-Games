import { Box } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 打开：useWindowStore.getState().openWindow('sokoban')
 * 收纳进「游戏」：features/games/ids.ts → GAME_APP_IDS
 */
registerBuiltinApp({
  id: 'sokoban',
  icon: Box,
  defaultCoordinate: [0, 5],
  width: 440,
  height: 640,
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Sokoban } = require('@/features/sokoban') as typeof import('@/features/sokoban')
    return Sokoban
  },
})
