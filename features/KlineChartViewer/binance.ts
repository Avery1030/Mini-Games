import { http } from '@/lib/http'
import { createManagedWebSocket, type ManagedWebSocket } from '@/lib/websocket'
import { KLINES_LIMIT, periodToInterval, type BinanceInterval, type Period } from './constants'

export type KLineBar = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnover: number
}

/** 币安 REST K 线原始行 */
export type BinanceKlineRaw = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
]

export type FetchKlinesParams = {
  symbol: string
  interval: BinanceInterval
  limit?: number
  startTime?: number
  endTime?: number
  signal?: AbortSignal
}

const BINANCE_CONTINUOUS_KLINES_URLS = [
  'https://www.binance.com/fapi/v1/continuousKlines',
  'https://fapi.binance.com/fapi/v1/continuousKlines',
] as const

export function normalizeBinanceKline(row: BinanceKlineRaw): KLineBar {
  return {
    timestamp: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    turnover: Number(row[7]),
  }
}

export function normalizeBinanceKlines(rows: BinanceKlineRaw[]): KLineBar[] {
  return rows.map(normalizeBinanceKline).sort((a, b) => a.timestamp - b.timestamp)
}

type ContinuousKlineQuery = {
  pair: string
  contractType: 'PERPETUAL'
  interval: BinanceInterval
  limit: number
  startTime?: number
  endTime?: number
}

/**
 * 浏览器直连币安 continuousKlines（与官网同一接口）。
 */
export async function fetchBinanceKlines(params: FetchKlinesParams): Promise<KLineBar[]> {
  const query: ContinuousKlineQuery = {
    pair: params.symbol.toUpperCase(),
    contractType: 'PERPETUAL',
    interval: params.interval,
    limit: params.limit ?? KLINES_LIMIT,
    startTime: params.startTime,
    endTime: params.endTime,
  }
  const errors: string[] = []

  for (const base of BINANCE_CONTINUOUS_KLINES_URLS) {
    try {
      const rows = await http.get<BinanceKlineRaw[], ContinuousKlineQuery>(base, {
        params: query,
        signal: params.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!Array.isArray(rows) || rows.length === 0) {
        errors.push(`${base} → empty`)
        continue
      }
      return normalizeBinanceKlines(rows)
    } catch (err) {
      if (params.signal?.aborted) throw err
      errors.push(`${base} → ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  throw new Error(`拉取合约 K 线失败：${errors[0] || '上游无响应'}`)
}

export async function fetchBarsForLoader(opts: {
  type: 'init' | 'forward' | 'backward' | 'update'
  timestamp: number | null
  symbol: string
  period: Period
  signal?: AbortSignal
}): Promise<{ bars: KLineBar[]; moreForward: boolean }> {
  const interval = periodToInterval(opts.period)
  if (!interval) return { bars: [], moreForward: false }

  if (opts.type === 'backward' || opts.type === 'update') {
    return { bars: [], moreForward: false }
  }

  const limit = KLINES_LIMIT
  const endTime = opts.type === 'forward' && opts.timestamp != null ? opts.timestamp - 1 : undefined

  const bars = await fetchBinanceKlines({
    symbol: opts.symbol,
    interval,
    limit,
    endTime,
    signal: opts.signal,
  })

  return {
    bars,
    moreForward: bars.length >= limit,
  }
}

export type KlineSocketHandlers = {
  onBar: (bar: KLineBar) => void
  onError?: (error: Event | Error) => void
}

function parseKlinePayload(raw: string): KLineBar | null {
  const payload = JSON.parse(raw) as {
    data?: {
      k?: {
        t: number
        o: string
        h: string
        l: string
        c: string
        v: string
        q: string
      }
    }
    k?: {
      t: number
      o: string
      h: string
      l: string
      c: string
      v: string
      q: string
    }
  }
  const k = payload.data?.k ?? payload.k
  if (!k) return null
  return {
    timestamp: k.t,
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
    turnover: Number(k.q),
  }
}

/** 订阅 U 本位永续实时 K 线（托管 WS：心跳看门狗 + 指数退避；失败则轮询） */
export function subscribeBinanceKline(
  symbol: string,
  interval: BinanceInterval,
  handlers: KlineSocketHandlers,
): () => void {
  const stream = `${symbol.toLowerCase()}_perpetual@continuousKline_${interval}`
  const wsUrls = [
    `wss://fstream.binance.com/market/ws/${stream}`,
    `wss://fstream.binancefuture.com/market/ws/${stream}`,
    `wss://fstream.binance.com/market/stream?streams=${stream}`,
    `wss://fstream.binancefuture.com/market/stream?streams=${stream}`,
  ]

  let closed = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let managed: ManagedWebSocket | null = null

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const startPoll = () => {
    if (closed || pollTimer) return
    const tick = async () => {
      if (closed) return
      try {
        const bars = await fetchBinanceKlines({ symbol, interval, limit: 2 })
        const last = bars[bars.length - 1]
        if (last) handlers.onBar(last)
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }
    void tick()
    pollTimer = setInterval(() => void tick(), 5_000)
  }

  managed = createManagedWebSocket({
    urls: wsUrls,
    // 币安协议层 ping/pong 由浏览器处理；应用层用收包看门狗检测半开 / 僵死连接
    heartbeatTimeout: 90_000,
    resetWatchdogOnAnyMessage: true,
    enableSendQueue: false,
    reconnectDelay: 1_000,
    maxReconnectDelay: 30_000,
    maxRetries: wsUrls.length * 4,
    listenNetwork: true,
    listenVisibility: true,
    // URL 已带 stream，重连后无需再发 SUBSCRIBE；预留 onReady 供鉴权型行情扩展
    onMessage: (event) => {
      try {
        const bar = parseKlinePayload(String(event.data))
        if (bar) handlers.onBar(bar)
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    },
    onError: ({ error }) => {
      handlers.onError?.(error)
    },
    onExhausted: () => {
      if (!closed) startPoll()
    },
  })

  return () => {
    closed = true
    stopPoll()
    managed?.close()
    managed = null
  }
}
