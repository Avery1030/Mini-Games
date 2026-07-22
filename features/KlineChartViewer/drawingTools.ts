import type { OverlayMode } from 'klinecharts'
import type { LucideIcon } from 'lucide-react'
import {
  Circle,
  Eye,
  EyeOff,
  Lock,
  Magnet,
  Minus,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Pencil,
  Percent,
  Slash,
  Square,
  Trash2,
  TrendingUp,
  Type,
  Unlock,
} from 'lucide-react'

/** 可绘制的 overlay 名称（与 klinecharts 内置一致） */
export type DrawingOverlayName =
  | 'segment'
  | 'straightLine'
  | 'rayLine'
  | 'horizontalStraightLine'
  | 'horizontalRayLine'
  | 'horizontalSegment'
  | 'verticalStraightLine'
  | 'verticalRayLine'
  | 'verticalSegment'
  | 'priceLine'
  | 'priceChannelLine'
  | 'parallelStraightLine'
  | 'fibonacciLine'
  | 'rect'
  | 'circle'
  | 'polygon'
  | 'brush'
  | 'simpleAnnotation'
  | 'simpleTag'

export type DrawingToolId = 'cursor' | DrawingOverlayName

export type DrawingToolDef = {
  id: DrawingToolId
  /** i18n key under klineChart.draw.* */
  labelKey: string
  icon: LucideIcon
  /** null = 选择/取消绘制 */
  overlay: DrawingOverlayName | null
}

export type DrawingToolGroup = {
  id: string
  labelKey: string
  icon: LucideIcon
  /** 组内默认工具（按钮上显示） */
  defaultTool: DrawingToolId
  tools: DrawingToolDef[]
}

export const CURSOR_TOOL: DrawingToolDef = {
  id: 'cursor',
  labelKey: 'cursor',
  icon: MousePointer2,
  overlay: null,
}

export const LINE_GROUP: DrawingToolGroup = {
  id: 'lines',
  labelKey: 'groupLines',
  icon: Slash,
  defaultTool: 'segment',
  tools: [
    { id: 'segment', labelKey: 'segment', icon: Minus, overlay: 'segment' },
    { id: 'straightLine', labelKey: 'straightLine', icon: Slash, overlay: 'straightLine' },
    { id: 'rayLine', labelKey: 'rayLine', icon: TrendingUp, overlay: 'rayLine' },
    {
      id: 'horizontalStraightLine',
      labelKey: 'horizontalLine',
      icon: MoveHorizontal,
      overlay: 'horizontalStraightLine',
    },
    {
      id: 'horizontalRayLine',
      labelKey: 'horizontalRay',
      icon: MoveHorizontal,
      overlay: 'horizontalRayLine',
    },
    {
      id: 'verticalStraightLine',
      labelKey: 'verticalLine',
      icon: MoveVertical,
      overlay: 'verticalStraightLine',
    },
    {
      id: 'verticalRayLine',
      labelKey: 'verticalRay',
      icon: MoveVertical,
      overlay: 'verticalRayLine',
    },
    { id: 'priceLine', labelKey: 'priceLine', icon: Minus, overlay: 'priceLine' },
  ],
}

export const FIB_GROUP: DrawingToolGroup = {
  id: 'fib',
  labelKey: 'groupFib',
  icon: Percent,
  defaultTool: 'fibonacciLine',
  tools: [
    { id: 'fibonacciLine', labelKey: 'fibonacci', icon: Percent, overlay: 'fibonacciLine' },
    {
      id: 'parallelStraightLine',
      labelKey: 'parallel',
      icon: Slash,
      overlay: 'parallelStraightLine',
    },
    {
      id: 'priceChannelLine',
      labelKey: 'priceChannel',
      icon: TrendingUp,
      overlay: 'priceChannelLine',
    },
  ],
}

export const SHAPE_GROUP: DrawingToolGroup = {
  id: 'shapes',
  labelKey: 'groupShapes',
  icon: Square,
  defaultTool: 'rect',
  tools: [
    { id: 'rect', labelKey: 'rect', icon: Square, overlay: 'rect' },
    { id: 'circle', labelKey: 'circle', icon: Circle, overlay: 'circle' },
    { id: 'polygon', labelKey: 'polygon', icon: Square, overlay: 'polygon' },
    { id: 'brush', labelKey: 'brush', icon: Pencil, overlay: 'brush' },
  ],
}

export const TEXT_GROUP: DrawingToolGroup = {
  id: 'text',
  labelKey: 'groupText',
  icon: Type,
  defaultTool: 'simpleAnnotation',
  tools: [
    { id: 'simpleAnnotation', labelKey: 'annotation', icon: Type, overlay: 'simpleAnnotation' },
    { id: 'simpleTag', labelKey: 'tag', icon: Type, overlay: 'simpleTag' },
  ],
}

export const DRAWING_GROUPS: DrawingToolGroup[] = [LINE_GROUP, FIB_GROUP, SHAPE_GROUP, TEXT_GROUP]

export type MagnetMode = OverlayMode

export const MAGNET_CYCLE: MagnetMode[] = ['normal', 'weak_magnet', 'strong_magnet']

export function nextMagnetMode(current: MagnetMode): MagnetMode {
  const i = MAGNET_CYCLE.indexOf(current)
  return MAGNET_CYCLE[(i + 1) % MAGNET_CYCLE.length]!
}

export function findTool(id: DrawingToolId): DrawingToolDef {
  if (id === 'cursor') return CURSOR_TOOL
  for (const group of DRAWING_GROUPS) {
    const found = group.tools.find((t) => t.id === id)
    if (found) return found
  }
  return CURSOR_TOOL
}

export function findGroupForTool(id: DrawingToolId): DrawingToolGroup | null {
  return DRAWING_GROUPS.find((g) => g.tools.some((t) => t.id === id)) ?? null
}

export const DRAW_ACTION_ICONS = {
  magnet: Magnet,
  lock: Lock,
  unlock: Unlock,
  visible: Eye,
  hidden: EyeOff,
  clear: Trash2,
} as const
