import { Folder } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'games',
  icon: Folder,
  defaultCoordinate: [0, 1],
  width: 360,
  height: 320,
  // 延迟加载，避免与各游戏 register 的加载顺序耦合
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GamesApp } = require('@/features/games') as typeof import('@/features/games')
    return GamesApp
  },
})
