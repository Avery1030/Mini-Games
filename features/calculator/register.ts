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
  chrome: { resizable: false, maximizable: false },
})
