import { BookOpenText } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { DocumentApp } from '.'

registerBuiltinApp({
  id: 'document',
  icon: BookOpenText,
  app: DocumentApp,
  defaultCoordinate: [1, 3],
  width: 520,
  height: 420,
  titles: { 'zh-CN': '文档', 'en-US': 'Document' },
})
