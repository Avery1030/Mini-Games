import { Terminal } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'cmd',
  icon: Terminal,
  defaultCoordinate: [3, 1],
  width: 640,
  height: 400,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CmdApp } = require('@/features/cmd') as typeof import('@/features/cmd')
    return CmdApp
  },
})
