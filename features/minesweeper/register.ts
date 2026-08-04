import { Gamepad } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { Minesweeper } from '.'

registerBuiltinApp({
  id: 'minesweeper',
  icon: Gamepad,
  app: Minesweeper,
  defaultCoordinate: [1, 1],
  width: 420,
  height: 560,
  titles: { 'zh-CN': '扫雷', 'en-US': 'Minesweeper' },
  showOnDesktop: false,
  showInStartMenu: false,
})
