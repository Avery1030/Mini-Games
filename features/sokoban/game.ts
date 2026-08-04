import { isWall, isVoid, hasBox } from './parseLevel'
import {
  DIR_DELTA,
  posKey,
  samePos,
  type CellPos,
  type Direction,
  type LevelData,
  type MoveSnapshot,
  type SokobanState,
} from './types'

export function createStateFromLevel(levelId: number, level: LevelData): SokobanState {
  return {
    levelId,
    level,
    player: { ...level.playerStart },
    boxes: level.boxes.map((b) => ({ ...b })),
    moves: 0,
    undoStack: [],
    won: false,
  }
}

export function isSolved(boxes: readonly CellPos[], targets: readonly CellPos[]): boolean {
  if (boxes.length !== targets.length) return false
  const need = new Set(targets.map(posKey))
  return boxes.every((b) => need.has(posKey(b)))
}

/**
 * 尝试朝 direction 移动；不可行则返回原状态。
 * 一次只能推一个箱子；前方是墙或第二只箱子则失败。
 */
export function tryMove(state: SokobanState, direction: Direction): SokobanState {
  if (state.won) return state

  const { level, player, boxes } = state
  const d = DIR_DELTA[direction]
  const nx = player.x + d.x
  const ny = player.y + d.y

  if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) return state
  if (isWall(level.walls, nx, ny) || isVoid(level.voids, nx, ny)) return state

  const snapshot: MoveSnapshot = {
    player: { ...player },
    boxes: boxes.map((b) => ({ ...b })),
  }

  let nextBoxes = boxes

  if (hasBox(boxes, nx, ny)) {
    const bx = nx + d.x
    const by = ny + d.y
    if (bx < 0 || by < 0 || bx >= level.width || by >= level.height) return state
    if (isWall(level.walls, bx, by) || isVoid(level.voids, bx, by)) return state
    if (hasBox(boxes, bx, by)) return state

    nextBoxes = boxes.map((b) => (b.x === nx && b.y === ny ? { x: bx, y: by } : b))
  }

  const nextPlayer = { x: nx, y: ny }
  const won = isSolved(nextBoxes, level.targets)

  return {
    ...state,
    player: nextPlayer,
    boxes: nextBoxes,
    moves: state.moves + 1,
    undoStack: [...state.undoStack, snapshot],
    won,
  }
}

export function undoMove(state: SokobanState): SokobanState {
  if (state.undoStack.length === 0) return state
  const stack = state.undoStack.slice()
  const last = stack.pop()
  if (!last) return state
  return {
    ...state,
    player: { ...last.player },
    boxes: last.boxes.map((b) => ({ ...b })),
    moves: Math.max(0, state.moves - 1),
    undoStack: stack,
    won: false,
  }
}

export function resetLevel(state: SokobanState): SokobanState {
  return createStateFromLevel(state.levelId, state.level)
}

export function boxOnTarget(box: CellPos, targets: readonly CellPos[]): boolean {
  return targets.some((t) => samePos(t, box))
}
