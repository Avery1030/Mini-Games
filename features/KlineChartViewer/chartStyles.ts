import type {
  CandleStyle,
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

/** 蜡烛图样式：涨跌绿红 + 含涨跌幅/振幅的 tooltip */
export function buildCandleStyles(): DeepPartial<Styles> {
  return {
    candle: {
      bar: {
        upColor: '#26a69a',
        upBorderColor: '#26a69a',
        upWickColor: '#26a69a',
        downColor: '#ef5350',
        downBorderColor: '#ef5350',
        downWickColor: '#ef5350',
      },
      priceMark: {
        last: {
          upColor: '#26a69a',
          downColor: '#ef5350',
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
