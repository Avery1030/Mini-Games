import type { OverlayTemplate } from 'klinecharts'
import { UP_COLOR } from './colors'

const FILL = 'rgba(45, 189, 133, 0.15)'
const STROKE = UP_COLOR

const DEFAULT_DRAW_FLAGS = {
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
} as const

const SHAPE_STYLES = {
  style: 'stroke_fill' as const,
  color: FILL,
  borderColor: STROKE,
  borderSize: 1,
}

type Point = { x: number; y: number }

function rectFigures(a: Point, b: Point) {
  return [
    {
      type: 'polygon' as const,
      attrs: {
        coordinates: [
          { x: a.x, y: a.y },
          { x: b.x, y: a.y },
          { x: b.x, y: b.y },
          { x: a.x, y: b.y },
        ],
      },
      styles: SHAPE_STYLES,
    },
  ]
}

function circleFigures(a: Point, b: Point) {
  return [
    {
      type: 'circle' as const,
      attrs: { x: a.x, y: a.y, r: Math.hypot(a.x - b.x, a.y - b.y) },
      styles: SHAPE_STYLES,
    },
  ]
}

/** 注册矩形 / 圆 / 多边形等自定义划线（klinecharts 未内置） */
export async function ensureDrawingOverlays() {
  const { registerOverlay } = await import('klinecharts')

  registerOverlay({
    name: 'rect',
    totalStep: 3,
    ...DEFAULT_DRAW_FLAGS,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      return rectFigures(coordinates[0]!, coordinates[1]!)
    },
  } satisfies OverlayTemplate)

  registerOverlay({
    name: 'circle',
    totalStep: 3,
    ...DEFAULT_DRAW_FLAGS,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      return circleFigures(coordinates[0]!, coordinates[1]!)
    },
  } satisfies OverlayTemplate)

  registerOverlay({
    name: 'polygon',
    totalStep: 4,
    ...DEFAULT_DRAW_FLAGS,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }]
      }
      return [
        {
          type: 'polygon',
          attrs: { coordinates },
          styles: SHAPE_STYLES,
        },
      ]
    },
  } satisfies OverlayTemplate)
}
