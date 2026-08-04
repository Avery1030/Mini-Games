import { Shapes } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 桌面窗口系统注册 / 打开示例：
 *
 * ```ts
 * import { Shapes } from 'lucide-react'
 * import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
 * import { CanvasJigsaw } from '@/features/canvas-jigsaw'
 * import { useWindowStore } from '@/store/window'
 *
 * registerBuiltinApp({
 *   id: 'canvasJigsaw',
 *   icon: Shapes,
 *   app: CanvasJigsaw,
 *   defaultCoordinate: [0, 4],
 *   width: 520,
 *   height: 680,
 *   titles: { 'zh-CN': '不规则拼图', 'en-US': 'Jigsaw' },
 *   showOnDesktop: false,
 *   showInStartMenu: false,
 * })
 *
 * // 打开：
 * useWindowStore.getState().openWindow('canvasJigsaw')
 * ```
 *
 * 收纳进「游戏」：features/games/ids.ts → GAME_APP_IDS 加入 'canvasJigsaw'
 */
registerBuiltinApp({
  id: 'canvasJigsaw',
  icon: Shapes,
  defaultCoordinate: [0, 4],
  width: 520,
  height: 680,
  titles: { 'zh-CN': '不规则拼图', 'en-US': 'Jigsaw' },
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CanvasJigsaw } = require('@/features/canvas-jigsaw') as typeof import('@/features/canvas-jigsaw')
    return CanvasJigsaw
  },
})
