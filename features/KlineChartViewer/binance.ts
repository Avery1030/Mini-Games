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

/** 经同源代理拉取币安 U 本位合约 K 线，避免浏览器 CORS / 直连失败 */
export async function fetchBinanceKlines(params: FetchKlinesParams): Promise<KLineBar[]> {
  const search = new URLSearchParams({
    symbol: params.symbol.toUpperCase(),
    interval: params.interval,
    limit: String(params.limit ?? KLINES_LIMIT),
  })
  if (params.startTime != null) search.set('startTime', String(params.startTime))
  if (params.endTime != null) search.set('endTime', String(params.endTime))

  const res = await fetch(`/api/binance/klines?${search.toString()}`, {
    signal: params.signal,
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `K线请求失败 (${res.status})`)
  }
  const rows = (await res.json()) as BinanceKlineRaw[]
  if (!Array.isArray(rows)) return []
  return normalizeBinanceKlines(rows)
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

/** 订阅 U 本位永续实时 K 线（币安 /market 分层；失败则轮询） */
export function subscribeBinanceKline(
  symbol: string,
  interval: BinanceInterval,
  handlers: KlineSocketHandlers,
): () => void {
  // 与 continuousKlines REST 对齐：pair_perpetual@continuousKline_<interval>
  const stream = `${symbol.toLowerCase()}_perpetual@continuousKline_${interval}`
  // 新分层路径：kline / continuousKline 属于 market 层（非 public/private）
  const wsUrls = [
    `wss://fstream.binance.com/market/ws/${stream}`,
    `wss://fstream.binancefuture.com/market/ws/${stream}`,
    `wss://fstream.binance.com/market/stream?streams=${stream}`,
    `wss://fstream.binancefuture.com/market/stream?streams=${stream}`,
  ]

  let closed = false
  let ws: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let wsIndex = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

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

  const parseKlinePayload = (raw: string) => {
    const payload = JSON.parse(raw) as {
      stream?: string
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
      e?: string
    }
    // combined stream: { stream, data: { e, k } }；单流：{ e, k }
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
    } satisfies KLineBar
  }

  const connectWs = () => {
    if (closed) return
    if (wsIndex >= wsUrls.length) {
      startPoll()
      return
    }
    const url = wsUrls[wsIndex]!
    try {
      ws = new WebSocket(url)
    } catch {
      wsIndex += 1
      connectWs()
      return
    }

    ws.onmessage = (event) => {
      try {
        const bar = parseKlinePayload(String(event.data))
        if (bar) handlers.onBar(bar)
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }

    ws.onerror = (event) => {
      handlers.onError?.(event)
    }

    ws.onclose = () => {
      ws = null
      if (closed) return
      wsIndex += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connectWs()
      }, 800)
    }
  }

  connectWs()

  return () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    stopPoll()
    if (ws) {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.close()
      ws = null
    }
  }
}
