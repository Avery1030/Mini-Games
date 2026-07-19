export const CANVAS_WIDTH = 640
export const CANVAS_HEIGHT = 400

export type PaintTool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse'

export const BRUSH_SIZES = [2, 4, 8, 14, 22] as const

/** Win95 风格调色板 */
export const PALETTE = [
  '#000000',
  '#808080',
  '#800000',
  '#808000',
  '#008000',
  '#008080',
  '#000080',
  '#800080',
  '#808040',
  '#004040',
  '#0080ff',
  '#004080',
  '#8000ff',
  '#804000',
  '#ffffff',
  '#c0c0c0',
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#ff00ff',
  '#ffff80',
  '#00ff80',
  '#80ffff',
  '#8080ff',
  '#ff0080',
  '#ff8040',
] as const

export type DrawingMeta = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  hasImage?: boolean
}

export type DrawingDetail = DrawingMeta & {
  imageUrl: string | null
}
