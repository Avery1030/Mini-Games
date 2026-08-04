import { tryMoveNoHistory } from './game'
import type { Direction, SokobanState } from './types'

/** 设为 false 可随时关掉破解演示（UI 与入口一并隐藏） */
export const ENABLE_CRACK_DEMO = true

/** 演示每步间隔（ms） */
export const CRACK_STEP_MS = 1000

const DIRS: Direction[] = ['up', 'down', 'left', 'right']
const MAX_SEARCH_NODES = 500_000

function encodeState(playerX: number, playerY: number, boxes: readonly { x: number; y: number }[]): string {
  const parts = boxes.map((b) => `${b.x},${b.y}`)
  parts.sort()
  return `${playerX},${playerY}|${parts.join(';')}`
}

/**
 * 从当前局面 BFS 求最少移动步数的方向序列；无解或超限则返回 null。
 * 已通关返回空数组。
 */
export function solveMinMoves(state: SokobanState): Direction[] | null {
  if (state.won) return []

  type Node = { player: { x: number; y: number }; boxes: { x: number; y: number }[]; level: SokobanState['level']; moves: number; won: boolean }

  const start: Node = {
    player: { ...state.player },
    boxes: state.boxes.map((b) => ({ ...b })),
    level: state.level,
    moves: 0,
    won: false,
  }

  const startKey = encodeState(start.player.x, start.player.y, start.boxes)
  const queue: Node[] = [start]
  const cameFrom = new Map<string, { prev: string; dir: Direction }>()
  const visited = new Set<string>([startKey])
  let head = 0
  let nodes = 0

  while (head < queue.length) {
    const cur = queue[head++]
    nodes++
    if (nodes > MAX_SEARCH_NODES) return null

    const asState: SokobanState = {
      levelId: state.levelId,
      level: cur.level,
      player: cur.player,
      boxes: cur.boxes,
      moves: cur.moves,
      undoStack: [],
      won: cur.won,
    }

    for (const dir of DIRS) {
      const next = tryMoveNoHistory(asState, dir)
      if (!next) continue

      const key = encodeState(next.player.x, next.player.y, next.boxes)
      if (visited.has(key)) continue
      visited.add(key)
      cameFrom.set(key, { prev: encodeState(cur.player.x, cur.player.y, cur.boxes), dir })

      if (next.won) {
        return reconstructPath(cameFrom, startKey, key)
      }

      queue.push({
        player: next.player,
        boxes: next.boxes as { x: number; y: number }[],
        level: cur.level,
        moves: next.moves,
        won: false,
      })
    }
  }

  return null
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
