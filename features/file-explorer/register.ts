import { HardDrive } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'fileExplorer',
  icon: HardDrive,
  defaultCoordinate: [2, 5],
  width: 560,
  height: 420,
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FileExplorerApp } = require('@/features/file-explorer') as typeof import('@/features/file-explorer')
    return FileExplorerApp
  },
})
