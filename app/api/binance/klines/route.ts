import dns from 'node:dns'
import { NextRequest, NextResponse } from 'next/server'

dns.setDefaultResultOrder('ipv4first')

const ALLOWED_INTERVALS = new Set([
  '1m',
  '5m',
  '15m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
])

/** Gate.io 可用周期映射 */
const GATE_INTERVAL: Record<string, string | null> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '8h': '8h',
  '12h': null,
  '1d': '1d',
  '3d': null,
  '1w': '7d',
  '1M': '30d',
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 仅在显式配置了可达的币安上游时尝试（默认不打 fapi，避免 TCP 长时间挂起）。
 */
async function fetchBinanceFuturesKlines(query: string): Promise<unknown[] | null> {
  const base = (process.env.BINANCE_FUTURES_API_URL || '').trim()
  // 未配置自定义上游时跳过：本机直连 fapi 常会卡数十秒
  if (!base) return null

  try {
    const data = await fetchJson(`${base.replace(/\/$/, '')}/fapi/v1/klines?${query}`, 3_000)
    if (!Array.isArray(data)) return null
    return data
  } catch {
    return null
  }
}

async function fetchGateFuturesKlines(opts: {
  symbol: string
  interval: string
  limit: number
  startTime?: string | null
  endTime?: string | null
}): Promise<unknown[] | null> {
  const gateInterval = GATE_INTERVAL[opts.interval]
  if (!gateInterval) return null

  const contract = opts.symbol.replace(/USDT$/, '_USDT')
  const params = new URLSearchParams({
    contract,
    interval: gateInterval,
    limit: String(Math.min(1000, opts.limit)),
  })
  if (opts.endTime && /^\d+$/.test(opts.endTime)) {
    params.set('to', String(Math.floor(Number(opts.endTime) / 1000)))
  }
  if (opts.startTime && /^\d+$/.test(opts.startTime)) {
    params.set('from', String(Math.floor(Number(opts.startTime) / 1000)))
  }

  const data = await fetchJson(
    `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?${params.toString()}`,
    8_000,
  )
  if (!Array.isArray(data)) return null

  type GateBar = {
    t: number | string
    o: string
    h: string
    l: string
    c: string
    v?: string | number
    sum?: string
  }

  return (data as GateBar[])
    .map((row) => {
      const ts = Number(row.t) * 1000
      return [
        ts,
        row.o,
        row.h,
        row.l,
        row.c,
        String(row.v ?? 0),
        ts,
        String(row.sum ?? 0),
        0,
        '0',
        '0',
        '0',
      ]
    })
    .sort((a, b) => (a[0] as number) - (b[0] as number))
}

/**
 * 合约 K 线代理：默认走 Gate.io（快且可达）；
 * 若设置 BINANCE_FUTURES_API_URL 则优先尝试该币安上游。
 * 实时推送仍由前端连接币安 WS。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const symbol = (searchParams.get('symbol') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const interval = searchParams.get('interval') ?? ''
  const limitRaw = searchParams.get('limit')
  const startTime = searchParams.get('startTime')
  const endTime = searchParams.get('endTime')

  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) {
    return NextResponse.json({ error: '无效交易对' }, { status: 400 })
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: '不支持的周期' }, { status: 400 })
  }

  const limit = Math.min(1500, Math.max(1, Number(limitRaw) || 500))
  const query = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  })
  if (startTime && /^\d+$/.test(startTime)) query.set('startTime', startTime)
  if (endTime && /^\d+$/.test(endTime)) query.set('endTime', endTime)

  try {
    const binance = await fetchBinanceFuturesKlines(query.toString())
    if (binance) {
      return NextResponse.json(binance, {
        headers: {
          'Cache-Control': 'public, max-age=5',
          'X-Kline-Source': 'binance-futures',
        },
      })
    }

    const gate = await fetchGateFuturesKlines({
      symbol,
      interval,
      limit,
      startTime,
      endTime,
    })
    if (gate && gate.length > 0) {
      return NextResponse.json(gate, {
        headers: {
          'Cache-Control': 'public, max-age=5',
          'X-Kline-Source': 'gateio',
        },
      })
    }

    return NextResponse.json(
      {
        error:
          interval === '12h' || interval === '3d'
            ? `周期 ${interval} 暂无可用数据源`
            : '拉取合约 K 线失败',
      },
      { status: 502 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: `拉取合约 K 线失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }
}
