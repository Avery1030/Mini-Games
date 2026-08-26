import type {
  CandleStyle,
  Chart,
  DeepPartial,
  NeighborData,
  Nullable,
  KLineData,
  Styles,
  TooltipLegend,
} from 'klinecharts'
import { DOWN_COLOR, UP_COLOR } from './colors'

/** 注册/覆盖 tooltip 文案（涨跌幅、振幅） */
export async function ensureKlineLocales() {
  const { registerLocale } = await import('klinecharts')
  registerLocale('zh-CN', {
    change: '涨跌幅：',
    amplitude: '振幅：',
  } as never)
  registerLocale('en-US', {
    change: 'Change: ',
    amplitude: 'Amplitude: ',
  } as never)
  registerLocale('ja-JP', {
    change: '騰落率：',
    amplitude: '振幅：',
  } as never)
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

function barColors(up: string, down: string) {
  return {
    upColor: up,
    upBorderColor: up,
    upWickColor: up,
    downColor: down,
    downBorderColor: down,
    downWickColor: down,
  }
}

function gridLine(isDark: boolean) {
  return {
    show: true,
    size: 0.5,
    color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    style: 'dashed' as const,
    dashedValue: [2, 2],
  }
}

/** 主图坐标网格：暗黑模式下低对比、更细 */
function buildGridStyles(isDark: boolean): DeepPartial<Styles>['grid'] {
  const line = gridLine(isDark)
  return { horizontal: line, vertical: line }
}

function amplitudeLegend(
  data: NeighborData<Nullable<KLineData>>,
  styles: CandleStyle,
): TooltipLegend[] {
  const current = data.current
  const prev = data.prev
  const prevClose = +(prev?.close ?? current?.close ?? 0)
  const high = +(current?.high ?? 0)
  const low = +(current?.low ?? 0)
  const close = +(current?.close ?? 0)
  const amplitude = prevClose > 0 ? ((high - low) / prevClose) * 100 : 0
  const isUp = close >= prevClose
  const ampColor = isUp ? styles.bar.upColor : styles.bar.downColor

  return [
    { title: 'time', value: '{time}' },
    { title: 'open', value: '{open}' },
    { title: 'high', value: '{high}' },
    { title: 'low', value: '{low}' },
    { title: 'close', value: '{close}' },
    { title: 'volume', value: '{volume}' },
    { title: 'change', value: '{change}' },
    {
      title: 'amplitude',
      value: { text: pct(amplitude), color: ampColor },
    },
  ]
}

/**
 * 自定义样式：网格 + 涨跌色 + tooltip 振幅。
 * 调用方应先 setStyles('dark'|'light') 再合并本返回值。
 */
export function buildCandleStyles(isDark = false): DeepPartial<Styles> {
  return {
    grid: buildGridStyles(isDark),
    candle: {
      bar: barColors(UP_COLOR, DOWN_COLOR),
      priceMark: {
        last: { upColor: UP_COLOR, downColor: DOWN_COLOR },
      },
      tooltip: {
        legend: { template: amplitudeLegend },
      },
    },
    indicator: {
      bars: [{ upColor: UP_COLOR, downColor: DOWN_COLOR }],
    },
  }
}

/** 应用内置 light/dark 主题，再叠加自定义网格与蜡烛样式 */
export function applyChartStyles(chart: Chart, isDark: boolean) {
  chart.setStyles(isDark ? 'dark' : 'light')
  chart.setStyles(buildCandleStyles(isDark))
}
