import { Puzzle } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

/**
 * 桌面窗口系统注册示例：
 *
 * ```ts
 * import { Puzzle } from 'lucide-react'
 * import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
 * import { ImagePuzzle } from '@/features/image-puzzle'
 *
 * registerBuiltinApp({
 *   id: 'imagePuzzle',
 *   icon: Puzzle,
 *   app: ImagePuzzle, // 或 loadApp: () => require(...).ImagePuzzle
 *   defaultCoordinate: [0, 3],
 *   width: 440,
 *   height: 620,
 *   titles: { 'zh-CN': '图片拼图', 'en-US': 'Image Puzzle' },
 *   showOnDesktop: false,
 *   showInStartMenu: false,
 * })
 *
 * // 打开窗口：
 * // useWindowStore.getState().openWindow('imagePuzzle')
 * ```
 *
 * 收纳进「游戏」文件夹：在 features/games/ids.ts 的 GAME_APP_IDS 中加入 'imagePuzzle'。
 */
registerBuiltinApp({
  id: 'imagePuzzle',
  icon: Puzzle,
  defaultCoordinate: [0, 3],
  width: 440,
  height: 620,
  titles: { 'zh-CN': '图片拼图', 'en-US': 'Image Puzzle' },
  showOnDesktop: false,
  showInStartMenu: false,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ImagePuzzle } = require('@/features/image-puzzle') as typeof import('@/features/image-puzzle')
    return ImagePuzzle
  },
})
