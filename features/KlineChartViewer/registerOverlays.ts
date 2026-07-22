import type { OverlayTemplate } from 'klinecharts'

const FILL = 'rgba(45, 189, 133, 0.15)'
const STROKE = '#2DBD85'

/** 注册矩形 / 圆等自定义划线（klinecharts 未内置这些 overlay） */
export async function ensureDrawingOverlays() {
  const { registerOverlay } = await import('klinecharts')

  registerOverlay({
    name: 'rect',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      const a = coordinates[0]!
      const b = coordinates[1]!
      return [
        {
          type: 'polygon',
          attrs: {
            coordinates: [
              { x: a.x, y: a.y },
              { x: b.x, y: a.y },
              { x: b.x, y: b.y },
              { x: a.x, y: b.y },
            ],
          },
          styles: {
            style: 'stroke_fill',
            color: FILL,
            borderColor: STROKE,
            borderSize: 1,
          },
        },
      ]
    },
  } satisfies OverlayTemplate)

  registerOverlay({
    name: 'circle',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      const a = coordinates[0]!
      const b = coordinates[1]!
      const radius = Math.hypot(a.x - b.x, a.y - b.y)
      return [
        {
          type: 'circle',
          attrs: { x: a.x, y: a.y, r: radius },
          styles: {
            style: 'stroke_fill',
            color: FILL,
            borderColor: STROKE,
            borderSize: 1,
          },
        },
      ]
    },
  } satisfies OverlayTemplate)

  registerOverlay({
    name: 'polygon',
    totalStep: 4,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ coordinates }) => {
      if (coordinates.length < 2) return []
      if (coordinates.length === 2) {
        return [{ type: 'line', attrs: { coordinates } }]
      }
      return [
        {
          type: 'polygon',
          attrs: { coordinates },
          styles: {
            style: 'stroke_fill',
            color: FILL,
            borderColor: STROKE,
            borderSize: 1,
          },
        },
      ]
    },
  } satisfies OverlayTemplate)
}
