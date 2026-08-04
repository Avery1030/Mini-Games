import { Cherry } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { Suika } from '.'

registerBuiltinApp({
  id: 'suika',
  icon: Cherry,
  app: Suika,
  defaultCoordinate: [0, 1],
  width: 520,
  height: 760,
  titles: { 'zh-CN': '合成大西瓜', 'en-US': 'Suika Game' },
  showOnDesktop: false,
  showInStartMenu: false,
  chrome: {
    resizable: false,
  },
})
