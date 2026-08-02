import { Trash2 } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'recycleBin',
  icon: Trash2,
  defaultCoordinate: [1, 5],
  width: 640,
  height: 440,
  titles: { 'zh-CN': '回收站', 'en-US': 'Recycle Bin' },
  showInStartMenu: false,
  // 延迟加载，避免 register → feature → store → registry 循环
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RecycleBinApp } = require('@/features/recycle-bin') as typeof import('@/features/recycle-bin')
    return RecycleBinApp
  },
})
