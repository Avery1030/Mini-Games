import { Calculator } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { CalculatorApp } from '.'

registerBuiltinApp({
  id: 'calculator',
  icon: Calculator,
  app: CalculatorApp,
  defaultCoordinate: [2, 4],
  width: 320,
  height: 480,
  titles: { 'zh-CN': '计算器', 'en-US': 'Calculator' },
  chrome: { resizable: false, maximizable: false },
})
