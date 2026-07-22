'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { cn } from '@/lib/cn'
import { useKlineChartStore } from '@/store'
import { DrawingToolbar } from './DrawingToolbar'
import { useDrawingSession } from './hooks/useDrawingSession'
import { useKlineChart } from './hooks/useKlineChart'
import { Toolbar } from './Toolbar'

export interface KlineChartViewerProps {
  embedded?: boolean
}

export function KlineChartViewer({ embedded = false }: KlineChartViewerProps) {
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

  const drawing = useDrawingSession({
    chartRef: chart.chartRef,
    ready: chart.ready,
    annotationPrompt: t('draw.annotation'),
  })

  return (
    <div className={embeddedAppShell(embedded, 'flex flex-col bg-window-body')}>
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
      <div className={cn('flex min-h-0 flex-1 bg-field')}>
        <DrawingToolbar
          collapsed={drawing.drawingToolbarCollapsed}
          activeTool={drawing.activeTool}
          magnetMode={drawing.magnetMode}
          stayInDrawing={drawing.stayInDrawing}
          locked={drawing.drawingsLocked}
          visible={drawing.drawingsVisible}
          onToggleCollapsed={drawing.toggleCollapsed}
          onSelectTool={drawing.selectTool}
          onCycleMagnet={drawing.cycleMagnet}
          onToggleStay={drawing.toggleStay}
          onToggleLock={drawing.toggleLock}
          onToggleVisible={drawing.toggleVisible}
          onClear={drawing.clearDrawings}
        />
        <div className='min-h-0 min-w-0 flex-1 p-1'>
          <div ref={chart.containerRef} className='h-full w-full' />
        </div>
      </div>
    </div>
  )
}
