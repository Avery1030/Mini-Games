import { Gamepad2 } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { Tetris } from '.'

registerBuiltinApp({
  id: 'tetris',
  icon: Gamepad2,
  app: Tetris,
  defaultCoordinate: [1, 2],
  width: 560,
  height: 640,
  titles: { 'zh-CN': '俄罗斯方块', 'en-US': 'Tetris' },
  showOnDesktop: false,
  showInStartMenu: false,
})
