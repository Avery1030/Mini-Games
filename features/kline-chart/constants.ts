/** 与 klinecharts.Period 对齐的本地类型，避免顶层依赖该库 */
export type PeriodType = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export type Period = {
  type: PeriodType
  span: number
}

/** 币安 K 线周期（与 REST / WS 一致） */
export type BinanceInterval = '1m' | '5m' | '15m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M'

/** 币安 continuousKlines / continuousKline 合约类型 */
export type BinanceContractType = 'PERPETUAL' | 'TRADIFI_PERPETUAL'

export type SymbolOption = {
  ticker: string
  label: string
  pricePrecision: number
  volumePrecision: number
  /** 默认 PERPETUAL；TradFi 标的用 TRADIFI_PERPETUAL */
  contractType?: BinanceContractType
}

export type IntervalOption = {
  value: BinanceInterval
  label: string
  period: Period
}

export type IndicatorKind = 'overlay' | 'pane'

export type IndicatorOption = {
  name: string
  label: string
  kind: IndicatorKind
}

export const SYMBOLS: SymbolOption[] = [
  { ticker: 'BTCUSDT', label: 'BTCUSDT', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'ETHUSDT', label: 'ETHUSDT', pricePrecision: 2, volumePrecision: 3 },
  { ticker: 'BNBUSDT', label: 'BNBUSDT', pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'SOLUSDT', label: 'SOLUSDT', pricePrecision: 2, volumePrecision: 2 },
  { ticker: 'XRPUSDT', label: 'XRPUSDT', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'DOGEUSDT', label: 'DOGEUSDT', pricePrecision: 5, volumePrecision: 0 },
  { ticker: 'ADAUSDT', label: 'ADAUSDT', pricePrecision: 4, volumePrecision: 1 },
  { ticker: 'AVAXUSDT', label: 'AVAXUSDT', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'DOTUSDT', label: 'DOTUSDT', pricePrecision: 3, volumePrecision: 2 },
  { ticker: 'ZECUSDT', label: 'ZECUSDT', pricePrecision: 3, volumePrecision: 2 },
  {
    ticker: 'SNDKUSDT',
    label: 'SNDKUSDT',
    pricePrecision: 2,
    volumePrecision: 2,
    contractType: 'TRADIFI_PERPETUAL',
  },
]

export const INTERVALS: IntervalOption[] = [
  { value: '1m', label: '1m', period: { span: 1, type: 'minute' } },
  { value: '5m', label: '5m', period: { span: 5, type: 'minute' } },
  { value: '15m', label: '15m', period: { span: 15, type: 'minute' } },
  { value: '1h', label: '1h', period: { span: 1, type: 'hour' } },
  { value: '2h', label: '2h', period: { span: 2, type: 'hour' } },
  { value: '4h', label: '4h', period: { span: 4, type: 'hour' } },
  { value: '8h', label: '8h', period: { span: 8, type: 'hour' } },
  { value: '1d', label: '1D', period: { span: 1, type: 'day' } },
  { value: '1w', label: '1W', period: { span: 1, type: 'week' } },
  { value: '1M', label: '1M', period: { span: 1, type: 'month' } },
]

/** 主图叠加指标 */
export const OVERLAY_INDICATORS: IndicatorOption[] = [
  { name: 'MA', label: 'MA', kind: 'overlay' },
  { name: 'EMA', label: 'EMA', kind: 'overlay' },
  { name: 'BOLL', label: 'BOLL', kind: 'overlay' },
  { name: 'SAR', label: 'SAR', kind: 'overlay' },
]

/** 副图指标 */
export const PANE_INDICATORS: IndicatorOption[] = [
  { name: 'VOL', label: 'VOL', kind: 'pane' },
  { name: 'MACD', label: 'MACD', kind: 'pane' },
  { name: 'KDJ', label: 'KDJ', kind: 'pane' },
  { name: 'RSI', label: 'RSI', kind: 'pane' },
  { name: 'WR', label: 'WR', kind: 'pane' },
  { name: 'CCI', label: 'CCI', kind: 'pane' },
  { name: 'OBV', label: 'OBV', kind: 'pane' },
]

export const DEFAULT_SYMBOL = SYMBOLS[0]!
export const DEFAULT_INTERVAL = INTERVALS.find((i) => i.value === '1h') ?? INTERVALS[0]!
export const DEFAULT_OVERLAYS = ['MA'] as const
export const DEFAULT_PANES = ['VOL'] as const

export const CANDLE_PANE_ID = 'candle_pane'
export const KLINES_LIMIT = 500

const PERIOD_KEY = (span: number, type: PeriodType) => `${span}-${type}`

const PERIOD_TO_INTERVAL = new Map<string, BinanceInterval>(
  INTERVALS.map((item) => [PERIOD_KEY(item.period.span, item.period.type), item.value]),
)

export function periodToInterval(period: Period): BinanceInterval | null {
  return PERIOD_TO_INTERVAL.get(PERIOD_KEY(period.span, period.type)) ?? null
}

export function findSymbol(ticker: string): SymbolOption {
  return SYMBOLS.find((s) => s.ticker === ticker) ?? DEFAULT_SYMBOL
}

export function findInterval(value: BinanceInterval): IntervalOption {
  return INTERVALS.find((i) => i.value === value) ?? DEFAULT_INTERVAL
}
