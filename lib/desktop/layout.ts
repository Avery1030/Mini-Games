import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'

export type { DesktopCoordinate }

/** 与桌面 grid 一致：单元格边长 + 间距（略加宽以容纳大字号中文标签） */
export const CELL_SIZE = 96
export const CELL_GAP = 10
export const CELL_STEP = CELL_SIZE + CELL_GAP

/** 超过该像素位移才视为拖拽（区分点击打开） */
export const DRAG_THRESHOLD = 6

/** 双击打开的时间窗口（ms） */
export const DBLCLICK_MS = 450

export function coordKey(coord: DesktopCoordinate): string {
  return `${coord[0]},${coord[1]}`
}

/** 由桌面内的 left/top（图标左上角）换算网格坐标 */
export function positionToCoordinate(left: number, top: number): DesktopCoordinate {
  const col = Math.max(1, Math.round(left / CELL_STEP) + 1)
  const row = Math.max(1, Math.round(top / CELL_STEP) + 1)
  return [col, row]
}

export function pointerToCoordinate(
  clientX: number,
  clientY: number,
  container: HTMLElement,
): DesktopCoordinate {
  const rect = container.getBoundingClientRect()
  const style = getComputedStyle(container)
  const padL = parseFloat(style.paddingLeft) || 0
  const padT = parseFloat(style.paddingTop) || 0
  const x = clientX - rect.left - padL
  const y = clientY - rect.top - padT
  return positionToCoordinate(x, y)
}

export function coordinateToPosition(coord: DesktopCoordinate): { left: number; top: number } {
  return {
    left: (coord[0] - 1) * CELL_STEP,
    top: (coord[1] - 1) * CELL_STEP,
  }
}

function findNearestFree(from: DesktopCoordinate, occupied: Set<string>): DesktopCoordinate {
  if (!occupied.has(coordKey(from))) return from

  // 优先同列向下/向上，更接近 Windows「挤开」的感觉
  const preferred: DesktopCoordinate[] = [
    [from[0], from[1] + 1],
    [from[0], Math.max(1, from[1] - 1)],
    [from[0] + 1, from[1]],
    [Math.max(1, from[0] - 1), from[1]],
  ]
  for (const cand of preferred) {
    const c: DesktopCoordinate = [Math.max(1, cand[0]), Math.max(1, cand[1])]
    if (!occupied.has(coordKey(c))) return c
  }

  for (let radius = 1; radius < 64; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const next: DesktopCoordinate = [Math.max(1, from[0] + dc), Math.max(1, from[1] + dr)]
        if (!occupied.has(coordKey(next))) return next
      }
    }
  }
  return [from[0] + 1, from[1]]
}

/** 消解同格冲突：priorityId 优先占格，其余必须让到空位，保证无一重叠 */
export function resolveOverlaps(
  positions: Map<DesktopAppId, DesktopCoordinate>,
  priorityId?: DesktopAppId,
): Map<DesktopAppId, DesktopCoordinate> {
  const next = new Map(positions)

  for (let pass = 0; pass < next.size + 4; pass++) {
    const cellOwners = new Map<string, DesktopAppId[]>()
    for (const [id, coord] of next) {
      const k = coordKey(coord)
      const list = cellOwners.get(k) ?? []
      list.push(id)
      cellOwners.set(k, list)
    }

    let moved = false
    for (const [, owners] of cellOwners) {
      if (owners.length <= 1) continue

      const stay = priorityId && owners.includes(priorityId) ? priorityId : owners[0]

      // 所有现有占位都算占用（含 stay 所在格），不能中途删掉冲突格
      const occupied = new Set<string>()
      for (const [, coord] of next) {
        occupied.add(coordKey(coord))
      }

      for (const id of owners) {
        if (id === stay) continue
        const current = next.get(id)!
        // current 与 stay 同格，occupied 仍含该格 → 必定找到其他空位
        const free = findNearestFree(current, occupied)
        next.set(id, free)
        occupied.add(coordKey(free))
        moved = true
      }
    }
    if (!moved) break
  }

  return next
}

type CoordApp = { id: DesktopAppId; coordinate: DesktopCoordinate }

/**
 * 将 dragId 放到 target；冲突时其他图标让位。
 * 返回完整布局（每个 app 的最终坐标），保证无重叠。
 */
export function previewPlacement(
  apps: CoordApp[],
  dragId: DesktopAppId,
  target: DesktopCoordinate,
): Map<DesktopAppId, DesktopCoordinate> {
  const next = new Map<DesktopAppId, DesktopCoordinate>()
  for (const app of apps) {
    next.set(
      app.id,
      app.id === dragId
        ? ([Math.max(1, target[0]), Math.max(1, target[1])] as DesktopCoordinate)
        : ([...app.coordinate] as DesktopCoordinate),
    )
  }
  return resolveOverlaps(next, dragId)
}

/** 仅取出相对原始坐标有变化的项，用于写入 store；priorityId 会排在最前供占格优先 */
export function diffCoordinates(
  apps: CoordApp[],
  next: Map<DesktopAppId, DesktopCoordinate>,
  priorityId?: DesktopAppId,
): Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }> {
  const updates: Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }> = []
  for (const app of apps) {
    const coord = next.get(app.id)
    if (!coord) continue
    if (app.coordinate[0] !== coord[0] || app.coordinate[1] !== coord[1]) {
      updates.push({ id: app.id, coordinate: coord })
    }
  }
  if (priorityId) {
    updates.sort((a, b) => (a.id === priorityId ? -1 : b.id === priorityId ? 1 : 0))
  }
  return updates
}

export function resolveCoordinate(
  app: CoordApp,
  preview: Nullable<Map<DesktopAppId, DesktopCoordinate>>,
): DesktopCoordinate {
  return preview?.get(app.id) ?? app.coordinate
}

export type ArrangeAlign = 'left' | 'right'

/**
 * 重新排列桌面图标：先沿列向下填满，再开下一列。
 * - left：从左上角向右铺
 * - right：从右上角向左铺（需 maxCols）
 * ids 顺序即排列顺序；maxRows 为每列最多行数（至少 1）。
 */
export function arrangeIcons(
  ids: DesktopAppId[],
  options: { maxRows?: number; align?: ArrangeAlign; maxCols?: number } = {},
): Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }> {
  const rows = Math.max(1, Math.floor(options.maxRows ?? 8))
  const align = options.align ?? 'left'
  const maxCols = Math.max(1, Math.floor(options.maxCols ?? 1))

  return ids.map((id, index) => {
    const colOffset = Math.floor(index / rows)
    const col =
      align === 'right' ? Math.max(1, maxCols - colOffset) : colOffset + 1
    const row = (index % rows) + 1
    return { id, coordinate: [col, row] as DesktopCoordinate }
  })
}

/** 按当前坐标排序（先列后行），用于重排时保持相对先后 */
export function sortIdsByCoordinate(
  apps: Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }>,
): DesktopAppId[] {
  return apps
    .slice()
    .sort((a, b) => a.coordinate[0] - b.coordinate[0] || a.coordinate[1] - b.coordinate[1])
    .map((a) => a.id)
}
