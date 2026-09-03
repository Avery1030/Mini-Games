/**
 * Canvas 2D 游戏工具导出面（无 React 窗口 / i18n / 桌面 store）。
 *
 * 游戏 UI 仍从各 `features/games/<name>` 引用原路径，避免改运行时绑定。
 * 独立开源时按模块复制：
 * - 多边形几何：`../canvas-jigsaw/geometry.ts` + `../canvas-jigsaw/types.ts`（Point）
 * - 圆体物理：`../suika/physics.ts` + `../suika/fruits.ts`
 */
export { dist, pointInPolygon, toAbsolutePoints, boundsOf } from '../canvas-jigsaw/geometry'
export type { Point } from '../canvas-jigsaw/types'

export {
  resolveCircleCollision,
  separateCircles,
  collideWorldBounds,
  clampWorldBounds,
  applyGravityAndIntegrate,
  hardSeparateAll,
  needsCollision,
  penetrationOf,
  type Body,
  type MergeEvent,
} from '../suika/physics'
