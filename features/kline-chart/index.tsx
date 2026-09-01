'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { useKlineChartStore } from './store'
import { useKlineChart } from './hooks/useKlineChart'
import { Toolbar } from './Toolbar'

export function KlineChartViewer() {
  const locale = useLocale()
  const t = useTranslations('klineChart')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const setSymbol = useKlineChartStore((s) => s.setSymbol)
  const setInterval = useKlineChartStore((s) => s.setInterval)
  const toggleOverlay = useKlineChartStore((s) => s.toggleOverlay)
  const togglePane = useKlineChartStore((s) => s.togglePane)

  const chart = useKlineChart({
    locale,
    isDark,
    loadFailedMessage: t('loadFailed'),
  })

  return (
    <div className={embeddedAppShell('flex flex-col bg-window-body')}>
      <Toolbar
        symbol={chart.symbol}
        interval={chart.interval}
        overlays={chart.overlays}
        panes={chart.panes}
        loading={chart.loading}
        error={chart.error}
        onSymbolChange={setSymbol}
        onIntervalChange={setInterval}
        onToggleOverlay={toggleOverlay}
        onTogglePane={togglePane}
      />
      <div className='relative min-h-0 flex-1 bg-field p-1'>
        <div ref={chart.containerRef} className='h-full w-full' />
      </div>
    </div>
  )
}
