'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
import type { Chart } from 'klinecharts'
import { useKlineChartStore } from '@/store'
import {
  findTool,
  nextMagnetMode,
  type DrawingToolId,
  type MagnetMode,
} from '../drawingTools'

type UseDrawingSessionOptions = {
  chartRef: RefObject<Chart | null>
  ready: boolean
  /** 用于文字标注 prompt 的默认标题 */
  annotationPrompt: string
}

/**
 * 划线工具会话：选工具、磁吸、锁定/显隐/清除、工具栏折叠。
 * 依赖外部 chartRef（由 useKlineChart 提供）。
 */
export function useDrawingSession({ chartRef, ready, annotationPrompt }: UseDrawingSessionOptions) {
  const stayInDrawingRef = useRef(false)
  const magnetModeRef = useRef<MagnetMode>('normal')
  const activeToolRef = useRef<DrawingToolId>('cursor')

  const [activeTool, setActiveTool] = useState<DrawingToolId>('cursor')
  const [magnetMode, setMagnetMode] = useState<MagnetMode>('normal')
  const [stayInDrawing, setStayInDrawing] = useState(false)
  const [drawingsLocked, setDrawingsLocked] = useState(false)
  const [drawingsVisible, setDrawingsVisible] = useState(true)

  const drawingToolbarCollapsed = useKlineChartStore((s) => s.drawingToolbarCollapsed)
  const toggleDrawingToolbarCollapsed = useKlineChartStore((s) => s.toggleDrawingToolbarCollapsed)

  stayInDrawingRef.current = stayInDrawing
  magnetModeRef.current = magnetMode
  activeToolRef.current = activeTool

  const cancelDrawingProgress = useCallback((chart: Chart) => {
    for (const overlay of chart.getOverlays()) {
      if (overlay.currentStep < overlay.totalStep) {
        chart.removeOverlay({ id: overlay.id })
      }
    }
  }, [])

  const startDrawing = useCallback(
    (chart: Chart, toolId: DrawingToolId) => {
      cancelDrawingProgress(chart)
      const tool = findTool(toolId)
      if (!tool.overlay) return

      const extendData =
        tool.overlay === 'simpleAnnotation'
          ? window.prompt(annotationPrompt, '') ?? ''
          : undefined

      chart.createOverlay({
        name: tool.overlay,
        mode: magnetModeRef.current,
        lock: drawingsLocked,
        visible: drawingsVisible,
        ...(extendData !== undefined ? { extendData } : {}),
        onDrawEnd: () => {
          if (stayInDrawingRef.current && activeToolRef.current === toolId) {
            queueMicrotask(() => {
              const c = chartRef.current
              if (c && activeToolRef.current === toolId) startDrawing(c, toolId)
            })
          } else {
            setActiveTool('cursor')
          }
        },
      })
    },
    [annotationPrompt, cancelDrawingProgress, chartRef, drawingsLocked, drawingsVisible],
  )

  const selectTool = useCallback(
    (toolId: DrawingToolId) => {
      const chart = chartRef.current
      setActiveTool(toolId)
      if (!chart || !ready) return
      if (toolId === 'cursor') {
        cancelDrawingProgress(chart)
        return
      }
      startDrawing(chart, toolId)
    },
    [cancelDrawingProgress, chartRef, ready, startDrawing],
  )

  const cycleMagnet = useCallback(() => {
    setMagnetMode((prev) => {
      const next = nextMagnetMode(prev)
      const chart = chartRef.current
      if (chart) {
        chart.overrideOverlay({ mode: next })
        if (activeToolRef.current !== 'cursor') {
          startDrawing(chart, activeToolRef.current)
        }
      }
      return next
    })
  }, [chartRef, startDrawing])

  const toggleStay = useCallback(() => {
    setStayInDrawing((v) => !v)
  }, [])

  const toggleLock = useCallback(() => {
    setDrawingsLocked((prev) => {
      const next = !prev
      chartRef.current?.overrideOverlay({ lock: next })
      return next
    })
  }, [chartRef])

  const toggleVisible = useCallback(() => {
    setDrawingsVisible((prev) => {
      const next = !prev
      chartRef.current?.overrideOverlay({ visible: next })
      return next
    })
  }, [chartRef])

  const clearDrawings = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.removeOverlay()
    setActiveTool('cursor')
  }, [chartRef])

  const toggleCollapsed = useCallback(() => {
    if (!drawingToolbarCollapsed) {
      selectTool('cursor')
    }
    toggleDrawingToolbarCollapsed()
  }, [drawingToolbarCollapsed, selectTool, toggleDrawingToolbarCollapsed])

  return {
    activeTool,
    magnetMode,
    stayInDrawing,
    drawingsLocked,
    drawingsVisible,
    drawingToolbarCollapsed,
    selectTool,
    cycleMagnet,
    toggleStay,
    toggleLock,
    toggleVisible,
    clearDrawings,
    toggleCollapsed,
  }
}
