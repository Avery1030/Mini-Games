import type { Chart } from 'klinecharts'
import { CANDLE_PANE_ID } from './constants'

/** 主图叠加指标：开启则创建，关闭则移除 */
export function syncCandleOverlay(chart: Chart, name: string, enabled: boolean) {
  if (enabled) {
    const exists = chart.getIndicators({ name, paneId: CANDLE_PANE_ID }).length > 0
    if (!exists) chart.createIndicator({ name, paneId: CANDLE_PANE_ID }, true)
    return
  }
  chart.removeIndicator({ name, paneId: CANDLE_PANE_ID })
}

/** 副图指标：开启则创建独立 pane，关闭则移除该指标的所有非主图实例 */
export function syncPaneIndicator(chart: Chart, name: string, enabled: boolean) {
  if (enabled) {
    const exists = chart.getIndicators({ name }).some((ind) => ind.paneId !== CANDLE_PANE_ID)
    if (!exists) chart.createIndicator(name)
    return
  }
  for (const ind of chart.getIndicators({ name })) {
    if (ind.paneId !== CANDLE_PANE_ID) chart.removeIndicator({ id: ind.id })
  }
}
