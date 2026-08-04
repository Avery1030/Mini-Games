import { LayoutGrid } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { TileMatch } from '.'

registerBuiltinApp({
  id: 'tileMatch',
  icon: LayoutGrid,
  app: TileMatch,
  defaultCoordinate: [0, 2],
  width: 390,
  height: 720,
  titles: { 'zh-CN': '格子消消', 'en-US': 'Tile Match' },
  showOnDesktop: false,
  showInStartMenu: false,
  chrome: {
    resizable: true,
  },
})
