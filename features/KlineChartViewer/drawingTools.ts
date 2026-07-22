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

/** 可绘制的 overlay 名称（与 klinecharts 内置 / 自定义注册一致） */
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
  defaultTool: DrawingToolId
  tools: DrawingToolDef[]
}

function overlayTool(
  id: DrawingOverlayName,
  labelKey: string,
  icon: LucideIcon,
): DrawingToolDef {
  return { id, labelKey, icon, overlay: id }
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
    overlayTool('segment', 'segment', Minus),
    overlayTool('straightLine', 'straightLine', Slash),
    overlayTool('rayLine', 'rayLine', TrendingUp),
    overlayTool('horizontalStraightLine', 'horizontalLine', MoveHorizontal),
    overlayTool('horizontalRayLine', 'horizontalRay', MoveHorizontal),
    overlayTool('verticalStraightLine', 'verticalLine', MoveVertical),
    overlayTool('verticalRayLine', 'verticalRay', MoveVertical),
    overlayTool('priceLine', 'priceLine', Minus),
  ],
}

export const FIB_GROUP: DrawingToolGroup = {
  id: 'fib',
  labelKey: 'groupFib',
  icon: Percent,
  defaultTool: 'fibonacciLine',
  tools: [
    overlayTool('fibonacciLine', 'fibonacci', Percent),
    overlayTool('parallelStraightLine', 'parallel', Slash),
    overlayTool('priceChannelLine', 'priceChannel', TrendingUp),
  ],
}

export const SHAPE_GROUP: DrawingToolGroup = {
  id: 'shapes',
  labelKey: 'groupShapes',
  icon: Square,
  defaultTool: 'rect',
  tools: [
    overlayTool('rect', 'rect', Square),
    overlayTool('circle', 'circle', Circle),
    overlayTool('polygon', 'polygon', Square),
    overlayTool('brush', 'brush', Pencil),
  ],
}

export const TEXT_GROUP: DrawingToolGroup = {
  id: 'text',
  labelKey: 'groupText',
  icon: Type,
  defaultTool: 'simpleAnnotation',
  tools: [
    overlayTool('simpleAnnotation', 'annotation', Type),
    overlayTool('simpleTag', 'tag', Type),
  ],
}

export const DRAWING_GROUPS: DrawingToolGroup[] = [LINE_GROUP, FIB_GROUP, SHAPE_GROUP, TEXT_GROUP]

const TOOL_BY_ID: Map<DrawingToolId, DrawingToolDef> = new Map([
  [CURSOR_TOOL.id, CURSOR_TOOL],
  ...DRAWING_GROUPS.flatMap((g) => g.tools.map((t) => [t.id, t] as const)),
])

const GROUP_BY_TOOL_ID: Map<DrawingToolId, DrawingToolGroup> = new Map(
  DRAWING_GROUPS.flatMap((g) => g.tools.map((t) => [t.id, g] as const)),
)

export type MagnetMode = OverlayMode

export const MAGNET_CYCLE: MagnetMode[] = ['normal', 'weak_magnet', 'strong_magnet']

export function nextMagnetMode(current: MagnetMode): MagnetMode {
  const i = MAGNET_CYCLE.indexOf(current)
  return MAGNET_CYCLE[(i + 1) % MAGNET_CYCLE.length]!
}

/** magnetMode → i18n key under klineChart.draw.* */
export function magnetLabelKey(mode: MagnetMode): 'magnetOff' | 'magnetWeak' | 'magnetStrong' {
  if (mode === 'strong_magnet') return 'magnetStrong'
  if (mode === 'weak_magnet') return 'magnetWeak'
  return 'magnetOff'
}

export function findTool(id: DrawingToolId): DrawingToolDef {
  return TOOL_BY_ID.get(id) ?? CURSOR_TOOL
}

export function findGroupForTool(id: DrawingToolId): DrawingToolGroup | null {
  return GROUP_BY_TOOL_ID.get(id) ?? null
}

export const DRAW_ACTION_ICONS = {
  magnet: Magnet,
  lock: Lock,
  unlock: Unlock,
  visible: Eye,
  hidden: EyeOff,
  clear: Trash2,
} as const
