import { ChartCandlestick } from 'lucide-react'
import { registerBuiltinApp } from '@/lib/desktop/window/defineApp'

registerBuiltinApp({
  id: 'klineChartViewer',
  icon: ChartCandlestick,
  defaultCoordinate: [3, 2],
  width: 1024,
  height: 768,

  // 延迟加载，避免 klinecharts 在 SSR 顶层访问 window
  loadApp: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KlineChartViewer } = require('@/features/KlineChartViewer') as typeof import('@/features/KlineChartViewer')
    return KlineChartViewer
  },
})
