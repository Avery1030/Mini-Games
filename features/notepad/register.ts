import { FileText } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { NotepadApp } from '.'

registerBuiltinApp({
  id: 'notepad',
  icon: FileText,
  app: NotepadApp,
  defaultCoordinate: [2, 1],
  width: 560,
  height: 460,
  titles: { 'zh-CN': '记事本', 'en-US': 'Notepad' },
})
