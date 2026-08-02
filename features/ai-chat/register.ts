import { Bot } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { AiChatApp } from '.'

registerBuiltinApp({
  id: 'aiChat',
  icon: Bot,
  app: AiChatApp,
  defaultCoordinate: [3, 3],
  width: 560,
  height: 520,
  titles: { 'zh-CN': '智聊', 'en-US': 'Zhi Chat' },
})
