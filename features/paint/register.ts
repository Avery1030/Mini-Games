import { Palette } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'
import { PaintApp } from '.'

registerBuiltinApp({
  id: 'paint',
  icon: Palette,
  app: PaintApp,
  defaultCoordinate: [2, 2],
  width: 720,
  height: 560,

})
