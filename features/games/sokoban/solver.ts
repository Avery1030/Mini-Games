import type { CellPos, Direction, LevelData, SokobanState } from './types'

/** 设为 false 可随时关掉破解演示（UI 与入口一并隐藏） */
export const ENABLE_CRACK_DEMO = true

/** 演示每步间隔（ms） */
export const CRACK_STEP_MS = 1000

const DIRS: Direction[] = ['up', 'down', 'left', 'right']
const DIR_DELTA: Record<Direction, CellPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const MAX_SEARCH_NODES = 2_000_000
/** 每批探索节点数，避免长时间占满主线程 */
const NODES_PER_SLICE = 8_000

type SolverContext = {
  width: number
  height: number
  blocked: Uint8Array
  targetsMask: bigint
  targetSet: Set<number>
  /** 简单死角：非目标且两正交墙夹住 */
  deadMask: bigint
}

function idx(width: number, x: number, y: number): number {
  return y * width + x
}

function buildContext(level: LevelData): SolverContext {
  const { width, height } = level
  const blocked = new Uint8Array(width * height)
  for (const w of level.walls) blocked[idx(width, w.x, w.y)] = 1
  for (const v of level.voids) blocked[idx(width, v.x, v.y)] = 1

  let targetsMask = 0n
  const targetSet = new Set<number>()
  for (const t of level.targets) {
    const i = idx(width, t.x, t.y)
    targetSet.add(i)
    targetsMask |= 1n << BigInt(i)
  }

  let deadMask = 0n
  const isBlocked = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return true
    return blocked[idx(width, x, y)] === 1
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBlocked(x, y)) continue
      const i = idx(width, x, y)
      if (targetSet.has(i)) continue
      const wallU = isBlocked(x, y - 1)
      const wallD = isBlocked(x, y + 1)
      const wallL = isBlocked(x - 1, y)
      const wallR = isBlocked(x + 1, y)
      // 角落死锁
      if ((wallU || wallD) && (wallL || wallR)) {
        deadMask |= 1n << BigInt(i)
      }
    }
  }

  return { width, height, blocked, targetsMask, targetSet, deadMask }
}

function boxesToMask(width: number, boxes: readonly CellPos[]): bigint {
  let mask = 0n
  for (const b of boxes) mask |= 1n << BigInt(idx(width, b.x, b.y))
  return mask
}

function encodeKey(player: number, boxes: bigint): string {
  return `${player}|${boxes.toString()}`
}

function hasDeadlock(boxes: bigint, deadMask: bigint): boolean {
  return (boxes & deadMask) !== 0n
}

function isSolved(boxes: bigint, targetsMask: bigint): boolean {
  return boxes === targetsMask
}

type SearchNode = {
  player: number
  boxes: bigint
  /** 到达该状态的路径末方向序列通过 cameFrom 回溯 */
}

/**
 * 从当前局面 BFS 求最少移动步数的方向序列；无解或超限则返回 null。
 * 已通关返回空数组。
 */
export function solveMinMoves(state: SokobanState): Nullable<Direction[]> {
  if (state.won) return []
  const result = solveSync(state)
  return result
}

/** 异步分片求解，避免卡住 UI；progress 可选 */
export function solveMinMovesAsync(
  state: SokobanState,
  opts?: { signal?: AbortSignal },
): Promise<Nullable<Direction[]>> {
  if (state.won) return Promise.resolve([])
  return solveChunked(state, opts?.signal)
}

function solveSync(state: SokobanState): Nullable<Direction[]> {
  const ctx = buildContext(state.level)
  const startPlayer = idx(ctx.width, state.player.x, state.player.y)
  const startBoxes = boxesToMask(ctx.width, state.boxes)
  if (hasDeadlock(startBoxes, ctx.deadMask)) return null

  const queue: SearchNode[] = [{ player: startPlayer, boxes: startBoxes }]
  const cameFrom = new Map<string, { prev: string; dir: Direction }>()
  const visited = new Set<string>([encodeKey(startPlayer, startBoxes)])
  let head = 0
  let nodes = 0

  while (head < queue.length) {
    const cur = queue[head++]
    nodes++
    if (nodes > MAX_SEARCH_NODES) return null

    const px = cur.player % ctx.width
    const py = (cur.player / ctx.width) | 0

    for (const dir of DIRS) {
      const d = DIR_DELTA[dir]
      const nx = px + d.x
      const ny = py + d.y
      if (nx < 0 || ny < 0 || nx >= ctx.width || ny >= ctx.height) continue
      const ni = idx(ctx.width, nx, ny)
      if (ctx.blocked[ni]) continue

      const bit = 1n << BigInt(ni)
      let nextBoxes = cur.boxes
      const nextPlayer = ni

      if ((cur.boxes & bit) !== 0n) {
        const bx = nx + d.x
        const by = ny + d.y
        if (bx < 0 || by < 0 || bx >= ctx.width || by >= ctx.height) continue
        const bi = idx(ctx.width, bx, by)
        if (ctx.blocked[bi]) continue
        const bBit = 1n << BigInt(bi)
        if ((cur.boxes & bBit) !== 0n) continue
        nextBoxes = (cur.boxes & ~bit) | bBit
        if (hasDeadlock(nextBoxes, ctx.deadMask)) continue
      }

      const key = encodeKey(nextPlayer, nextBoxes)
      if (visited.has(key)) continue
      visited.add(key)
      const prevKey = encodeKey(cur.player, cur.boxes)
      cameFrom.set(key, { prev: prevKey, dir })

      if (isSolved(nextBoxes, ctx.targetsMask)) {
        return reconstructPath(cameFrom, encodeKey(startPlayer, startBoxes), key)
      }

      queue.push({ player: nextPlayer, boxes: nextBoxes })
    }
  }

  return null
}

function solveChunked(state: SokobanState, signal?: AbortSignal): Promise<Nullable<Direction[]>> {
  return new Promise((resolve) => {
    const ctx = buildContext(state.level)
    const startPlayer = idx(ctx.width, state.player.x, state.player.y)
    const startBoxes = boxesToMask(ctx.width, state.boxes)
    if (hasDeadlock(startBoxes, ctx.deadMask)) {
      resolve(null)
      return
    }

    const queue: SearchNode[] = [{ player: startPlayer, boxes: startBoxes }]
    const cameFrom = new Map<string, { prev: string; dir: Direction }>()
    const visited = new Set<string>([encodeKey(startPlayer, startBoxes)])
    let head = 0
    let nodes = 0
    const startKey = encodeKey(startPlayer, startBoxes)

    const step = () => {
      if (signal?.aborted) {
        resolve(null)
        return
      }

      let budget = NODES_PER_SLICE
      while (budget-- > 0 && head < queue.length) {
        const cur = queue[head++]
        nodes++
        if (nodes > MAX_SEARCH_NODES) {
          resolve(null)
          return
        }

        const px = cur.player % ctx.width
        const py = (cur.player / ctx.width) | 0

        for (const dir of DIRS) {
          const d = DIR_DELTA[dir]
          const nx = px + d.x
          const ny = py + d.y
          if (nx < 0 || ny < 0 || nx >= ctx.width || ny >= ctx.height) continue
          const ni = idx(ctx.width, nx, ny)
          if (ctx.blocked[ni]) continue

          const bit = 1n << BigInt(ni)
          let nextBoxes = cur.boxes
          const nextPlayer = ni

          if ((cur.boxes & bit) !== 0n) {
            const bx = nx + d.x
            const by = ny + d.y
            if (bx < 0 || by < 0 || bx >= ctx.width || by >= ctx.height) continue
            const bi = idx(ctx.width, bx, by)
            if (ctx.blocked[bi]) continue
            const bBit = 1n << BigInt(bi)
            if ((cur.boxes & bBit) !== 0n) continue
            nextBoxes = (cur.boxes & ~bit) | bBit
            if (hasDeadlock(nextBoxes, ctx.deadMask)) continue
          }

          const key = encodeKey(nextPlayer, nextBoxes)
          if (visited.has(key)) continue
          visited.add(key)
          cameFrom.set(key, { prev: encodeKey(cur.player, cur.boxes), dir })

          if (isSolved(nextBoxes, ctx.targetsMask)) {
            resolve(reconstructPath(cameFrom, startKey, key))
            return
          }

          queue.push({ player: nextPlayer, boxes: nextBoxes })
        }
      }

      if (head >= queue.length) {
        resolve(null)
        return
      }

      // 让出主线程
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(step)
      } else {
        setTimeout(step, 0)
      }
    }

    step()
  })
}

function reconstructPath(
  cameFrom: Map<string, { prev: string; dir: Direction }>,
  startKey: string,
  endKey: string,
): Direction[] {
  const path: Direction[] = []
  let key = endKey
  while (key !== startKey) {
    const step = cameFrom.get(key)
    if (!step) break
    path.push(step.dir)
    key = step.prev
  }
  path.reverse()
  return path
}
