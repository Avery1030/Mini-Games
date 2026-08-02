import { Terminal } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'cmd',
  icon: Terminal,
  defaultCoordinate: [3, 1],
  width: 640,
  height: 400,
  titles: { 'zh-CN': '命令提示符', 'en-US': 'Command Prompt' },
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CmdApp } = require('@/features/cmd') as typeof import('@/features/cmd')
    return CmdApp
  },
})
