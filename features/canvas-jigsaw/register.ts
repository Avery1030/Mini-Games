import { Shapes } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 打开：useWindowStore.getState().openWindow('canvasJigsaw')
 * 收纳进「游戏」：features/games/ids.ts → GAME_APP_IDS
 */
registerBuiltinApp({
  id: 'canvasJigsaw',
  icon: Shapes,
  defaultCoordinate: [0, 4],
  width: 520,
  height: 680,
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CanvasJigsaw } = require('@/features/canvas-jigsaw') as typeof import('@/features/canvas-jigsaw')
    return CanvasJigsaw
  },
})
