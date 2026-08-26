'use client'

import { findInterval, findSymbol, OVERLAY_INDICATORS, PANE_INDICATORS, periodToInterval } from '../constants'
import { applyChartStyles, ensureKlineLocales } from '../chartStyles'
import { useEffect, useRef, useState } from 'react'
import type { Chart, DataLoader } from 'klinecharts'
import { useKlineChartStore } from '../store'
import { fetchBarsForLoader, subscribeBinanceKline } from '../binance'
import { syncCandleOverlay, syncPaneIndicator } from '../indicators'

type UseKlineChartOptions = {
  locale: string
  isDark: boolean
  loadFailedMessage: string
}

/**
 * 图表生命周期：初始化 / 销毁、数据加载、主题语言、品种周期与指标同步。
 */
export function useKlineChart({ locale, isDark, loadFailedMessage }: UseKlineChartOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const requestIdRef = useRef(0)
  const subStopsRef = useRef(new Map<string, () => void>())

  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const symbol = useKlineChartStore((s) => s.symbol)
  const interval = useKlineChartStore((s) => s.interval)
  const overlays = useKlineChartStore((s) => s.overlays)
  const panes = useKlineChartStore((s) => s.panes)

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
      applyChartStyles(chart, document.documentElement.classList.contains('dark'))

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
            setError(err instanceof Error ? err.message : loadFailedMessage)
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
    // 仅挂载时初始化；语言 / 主题由下方 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    void ensureKlineLocales().then(() => {
      chart.setLocale(locale)
      applyChartStyles(chart, isDark)
    })
  }, [locale, isDark, ready])

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
      syncCandleOverlay(chart, item.name, overlays.includes(item.name))
    }
  }, [overlays, ready])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !ready) return
    for (const item of PANE_INDICATORS) {
      syncPaneIndicator(chart, item.name, panes.includes(item.name))
    }
  }, [panes, ready])

  return {
    containerRef,
    chartRef,
    ready,
    loading,
    error,
    symbol,
    interval,
    overlays,
    panes,
  }
}
