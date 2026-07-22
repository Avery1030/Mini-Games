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
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

/** 主图坐标网格：暗黑模式下低对比、更细，避免抢视线 */
function buildGridStyles(isDark: boolean): DeepPartial<Styles>['grid'] {
  return {
    horizontal: {
      show: true,
      size: 0.5,
      color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      style: 'dashed',
      dashedValue: [2, 2],
    },
    vertical: {
      show: true,
      size: 0.5,
      color: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      style: 'dashed',
      dashedValue: [2, 2],
    },
  }
}

/**
 * 蜡烛图样式：主题色 + 涨跌绿红 + 含涨跌幅/振幅的 tooltip。
 * 先 setStyles('dark'|'light') 再合并本函数返回值。
 */
export function buildCandleStyles(isDark = false): DeepPartial<Styles> {
  return {
    grid: buildGridStyles(isDark),
    candle: {
      bar: {
        upColor: '#2DBD85',
        upBorderColor: '#2DBD85',
        upWickColor: '#2DBD85',
        downColor: '#F6475D',
        downBorderColor: '#F6475D',
        downWickColor: '#F6475D',
      },
      priceMark: {
        last: {
          upColor: '#2DBD85',
          downColor: '#F6475D',
        },
      },
      tooltip: {
        legend: {
          template: (
            data: NeighborData<Nullable<KLineData>>,
            styles: CandleStyle,
          ): TooltipLegend[] => {
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
                value: {
                  text: pct(amplitude),
                  color: ampColor,
                },
              },
            ]
          },
        },
      },
    },
  }
}

/** 应用内置 light/dark 主题，再叠加自定义网格与蜡烛样式 */
export function applyChartStyles(chart: Chart, isDark: boolean) {
  chart.setStyles(isDark ? 'dark' : 'light')
  chart.setStyles(buildCandleStyles(isDark))
}
