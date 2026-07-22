'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { Chart, DataLoader } from 'klinecharts'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { cn } from '@/lib/cn'
import { useKlineChartStore } from '@/store'
import { fetchBarsForLoader, subscribeBinanceKline } from './binance'
import { buildCandleStyles, ensureKlineLocales } from './chartStyles'
import {
  CANDLE_PANE_ID,
  findInterval,
  findSymbol,
  OVERLAY_INDICATORS,
  PANE_INDICATORS,
  periodToInterval,
} from './constants'
import { Toolbar } from './Toolbar'

export interface KlineChartViewerProps {
  embedded?: boolean
}

export function KlineChartViewer({ embedded = false }: KlineChartViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const requestIdRef = useRef(0)
  const subStopsRef = useRef(new Map<string, () => void>())
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locale = useLocale()
  const t = useTranslations('klineChart')

  const symbol = useKlineChartStore((s) => s.symbol)
  const interval = useKlineChartStore((s) => s.interval)
  const overlays = useKlineChartStore((s) => s.overlays)
  const panes = useKlineChartStore((s) => s.panes)
  const setSymbol = useKlineChartStore((s) => s.setSymbol)
  const setInterval = useKlineChartStore((s) => s.setInterval)
  const toggleOverlay = useKlineChartStore((s) => s.toggleOverlay)
  const togglePane = useKlineChartStore((s) => s.togglePane)

  const applyOverlay = useCallback((chart: Chart, name: string, enabled: boolean) => {
    if (enabled) {
      const exists = chart.getIndicators({ name, paneId: CANDLE_PANE_ID }).length > 0
      if (!exists) chart.createIndicator({ name, paneId: CANDLE_PANE_ID }, true)
    } else {
      chart.removeIndicator({ name, paneId: CANDLE_PANE_ID })
    }
  }, [])

  const applyPane = useCallback((chart: Chart, name: string, enabled: boolean) => {
    if (enabled) {
      const exists = chart.getIndicators({ name }).some((ind) => ind.paneId !== CANDLE_PANE_ID)
      if (!exists) chart.createIndicator(name)
    } else {
      for (const ind of chart.getIndicators({ name })) {
        if (ind.paneId !== CANDLE_PANE_ID) chart.removeIndicator({ id: ind.id })
      }
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    const stops = subStopsRef.current

    void (async () => {
      const { init } = await import('klinecharts')
      await ensureKlineLocales()
      if (cancelled || !containerRef.current) return

      const chart = init(containerRef.current, {
        locale,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      })
      if (!chart) return

      chartRef.current = chart
      chart.setStyles(buildCandleStyles())

      const dataLoader: DataLoader = {
        getBars: async ({ type, timestamp, symbol: sym, period, callback }) => {
          const requestId = ++requestIdRef.current
          setLoading(true)
          setError(null)
          try {
            const { bars, moreForward } = await fetchBarsForLoader({
              type,
              timestamp,
              symbol: sym.ticker,
              period,
            })
            if (requestId !== requestIdRef.current) return
            callback(bars, { forward: moreForward, backward: false })
          } catch (err) {
            if (requestId !== requestIdRef.current) return
            setError(err instanceof Error ? err.message : t('loadFailed'))
            callback([])
          } finally {
            if (requestId === requestIdRef.current) setLoading(false)
          }
        },
        subscribeBar: ({ symbol: sym, period, callback }) => {
          const iv = periodToInterval(period)
          if (!iv) return
          const key = `${sym.ticker}:${iv}`
          stops.get(key)?.()
          stops.set(key, subscribeBinanceKline(sym.ticker, iv, { onBar: callback }))
        },
        unsubscribeBar: ({ symbol: sym, period }) => {
          const iv = periodToInterval(period)
          if (!iv) return
          const key = `${sym.ticker}:${iv}`
          stops.get(key)?.()
          stops.delete(key)
        },
      }

      chart.setDataLoader(dataLoader)
      resizeObserver = new ResizeObserver(() => chart.resize())
      resizeObserver.observe(containerRef.current)
      chart.resize()
      setReady(true)
    })()

    return () => {
      cancelled = true
      setReady(false)
      requestIdRef.current += 1
      resizeObserver?.disconnect()
      stops.forEach((stop) => stop())
      stops.clear()
      const chart = chartRef.current
      chartRef.current = null
      if (chart) {
        void import('klinecharts').then(({ dispose }) => dispose(chart))
      }
    }
    // 仅挂载时初始化；语言切换由下方 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    void ensureKlineLocales().then(() => {
      chart.setLocale(locale)
      chart.setStyles(buildCandleStyles())
    })
  }, [locale, ready])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    const meta = findSymbol(symbol)
    const iv = findInterval(interval)
    chart.setSymbol({
      ticker: meta.ticker,
      pricePrecision: meta.pricePrecision,
      volumePrecision: meta.volumePrecision,
    })
    chart.setPeriod(iv.period)
  }, [symbol, interval, ready])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    for (const item of OVERLAY_INDICATORS) {
      applyOverlay(chart, item.name, overlays.includes(item.name))
    }
  }, [overlays, ready, applyOverlay])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    for (const item of PANE_INDICATORS) {
      applyPane(chart, item.name, panes.includes(item.name))
    }
  }, [panes, ready, applyPane])

  return (
    <div className={embeddedAppShell(embedded, 'flex flex-col bg-window-body')}>
      <Toolbar
        symbol={symbol}
        interval={interval}
        overlays={overlays}
        panes={panes}
        loading={loading}
        error={error}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onToggleOverlay={toggleOverlay}
        onTogglePane={togglePane}
      />
      <div className={cn('min-h-0 flex-1 bg-field p-1')}>
        <div ref={containerRef} className='h-full w-full' />
      </div>
    </div>
  )
}
