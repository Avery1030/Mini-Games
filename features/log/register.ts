import { Notebook } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { LogApp } from '.'

registerBuiltinApp({
  id: 'log',
  icon: Notebook,
  app: LogApp,
  defaultCoordinate: [1, 4],
  width: 520,
  height: 420,
  titles: { 'zh-CN': '日志', 'en-US': 'Log' },
})
