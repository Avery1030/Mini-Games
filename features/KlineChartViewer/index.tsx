'use client'

import { useEffect, useRef } from 'react'
import type { Chart } from 'klinecharts'

export interface KlineChartViewerProps {
  embedded?: boolean
}

export function KlineChartViewer(_props: KlineChartViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    void import('klinecharts').then(({ init }) => {
      if (cancelled || !containerRef.current) return

      const chart = init(containerRef.current)
      if (!chart) return

      chartRef.current = chart
      chart.setSymbol({ ticker: 'TestSymbol' })
      chart.setPeriod({ span: 1, type: 'day' })
      chart.setDataLoader({
        getBars: ({ callback }) => {
          fetch('https://klinecharts.com/datas/kline.json')
            .then((res) => res.json())
            .then((dataList) => {
              if (!cancelled) callback(dataList)
            })
        },
      })
    })

    return () => {
      cancelled = true
      const chart = chartRef.current
      chartRef.current = null
      if (chart) {
        void import('klinecharts').then(({ dispose }) => {
          dispose(chart)
        })
      }
    }
  }, [])

  return <div ref={containerRef} className='h-full w-full' />
}
