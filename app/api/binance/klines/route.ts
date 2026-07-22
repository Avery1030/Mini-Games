import dns from 'node:dns'
import { NextRequest, NextResponse } from 'next/server'

dns.setDefaultResultOrder('ipv4first')

const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '1h', '2h', '4h', '8h', '1d', '1w', '1M'])

const BINANCE_CONTINUOUS_BASES = ['https://www.binance.com', 'https://fapi.binance.com'] as const

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
 * 币安 U 本位永续连续合约历史 K 线
 * GET /fapi/v1/continuousKlines?pair=BTCUSDT&contractType=PERPETUAL&interval=1h&limit=1000
 */
async function fetchBinanceContinuousKlines(opts: {
  pair: string
  interval: string
  limit: number
  startTime?: string | null
  endTime?: string | null
}): Promise<unknown[]> {
  const query = new URLSearchParams({
    pair: opts.pair,
    contractType: 'PERPETUAL',
    interval: opts.interval,
    limit: String(opts.limit),
  })
  if (opts.startTime && /^\d+$/.test(opts.startTime)) query.set('startTime', opts.startTime)
  if (opts.endTime && /^\d+$/.test(opts.endTime)) query.set('endTime', opts.endTime)

  const qs = query.toString()
  return Promise.any(
    BINANCE_CONTINUOUS_BASES.map(async (base) => {
      const data = await fetchJson(`${base}/fapi/v1/continuousKlines?${qs}`, 12_000)
      if (!Array.isArray(data) || data.length === 0) throw new Error('empty')
      return data as unknown[]
    }),
  )
}

/** 代理币安 continuousKlines（永续历史 K 线） */
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

  try {
    const data = await fetchBinanceContinuousKlines({
      pair: symbol,
      interval,
      limit,
      startTime,
      endTime,
    })
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=5',
        'X-Kline-Source': 'binance-continuous',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: `拉取合约 K 线失败：${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    )
  }
}
