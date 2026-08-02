import { Settings } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { SettingsApp } from '.'

registerBuiltinApp({
  id: 'settings',
  icon: Settings,
  app: SettingsApp,
  defaultCoordinate: [2, 3],
  width: 560,
  height: 520,
  titles: { 'zh-CN': '设置', 'en-US': 'Settings' },
})
