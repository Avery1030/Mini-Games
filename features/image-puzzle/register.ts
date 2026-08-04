import { Puzzle } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 打开：useWindowStore.getState().openWindow('imagePuzzle')
 * 收纳进「游戏」：features/games/ids.ts → GAME_APP_IDS
 */
registerBuiltinApp({
  id: 'imagePuzzle',
  icon: Puzzle,
  defaultCoordinate: [0, 3],
  width: 440,
  height: 620,
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ImagePuzzle } = require('@/features/image-puzzle') as typeof import('@/features/image-puzzle')
    return ImagePuzzle
  },
})
