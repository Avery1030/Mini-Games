import { AppWindow } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'taskManager',
  icon: AppWindow,
  defaultCoordinate: [3, 4],
  width: 420,
  height: 480,
  titles: { 'zh-CN': '任务管理器', 'en-US': 'Task Manager' },
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TaskManagerApp } = require('@/features/task-manager') as typeof import('@/features/task-manager')
    return TaskManagerApp
  },
})
