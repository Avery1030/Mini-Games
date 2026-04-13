export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export type Board = CellValue[][]

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

export interface Piece {
  type: TetrominoType
  rotation: number
  x: number
  y: number
}

export interface TetrisState {
  board: Board
  current: Piece
  nextType: TetrominoType
  score: number
  lines: number
  level: number
  status: 'playing' | 'gameover' | 'paused'
  recentClearCount: number
}

type Matrix = number[][]

const EMPTY_BOARD: Board = Array.from({ length: BOARD_HEIGHT }, () =>
  Array.from({ length: BOARD_WIDTH }, () => 0 as CellValue),
)

const SHAPES: Record<TetrominoType, Matrix[]> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
    [
      [1, 1],
      [1, 1],
    ],
  ],
  T: [
    [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 0, 0],
      [0, 1, 1],
      [1, 1, 0],
    ],
    [
      [1, 0, 0],
      [1, 1, 0],
      [0, 1, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 1, 0],
      [1, 1, 0],
      [1, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 1],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 1],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
  ],
}

const TYPE_VALUE: Record<TetrominoType, CellValue> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
}

export const TETROMINO_VALUE_MAP: Record<TetrominoType, CellValue> = TYPE_VALUE

const ALL_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]) as Board
}

function randomType(): TetrominoType {
  return ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)]
}

function createPiece(type: TetrominoType): Piece {
  const shape = SHAPES[type][0]
  const w = shape[0].length
  return {
    type,
    rotation: 0,
    x: Math.floor((BOARD_WIDTH - w) / 2),
    y: 0,
  }
}

export function createInitialState(): TetrisState {
  const first = randomType()
  return {
    board: cloneBoard(EMPTY_BOARD),
    current: createPiece(first),
    nextType: randomType(),
    score: 0,
    lines: 0,
    level: 1,
    status: 'playing',
    recentClearCount: 0,
  }
}

function getShape(piece: Piece): Matrix {
  return SHAPES[piece.type][piece.rotation % 4]
}

function collides(board: Board, piece: Piece): boolean {
  const shape = getShape(piece)
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 0) continue
      const x = piece.x + c
      const y = piece.y + r
      if (x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return true
      if (y >= 0 && board[y][x] !== 0) return true
    }
  }
  return false
}

function mergePiece(board: Board, piece: Piece): Board {
  const next = cloneBoard(board)
  const shape = getShape(piece)
  const value = TYPE_VALUE[piece.type]
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 0) continue
      const x = piece.x + c
      const y = piece.y + r
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) next[y][x] = value
    }
  }
  return next
}

function clearFullLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((v) => v === 0))
  const cleared = BOARD_HEIGHT - kept.length
  const fresh: Board = Array.from({ length: cleared }, () =>
    Array.from({ length: BOARD_WIDTH }, () => 0 as CellValue),
  )
  return { board: [...fresh, ...kept] as Board, cleared }
}

function pointsForLines(cleared: number, level: number): number {
  if (cleared === 1) return 100 * level
  if (cleared === 2) return 300 * level
  if (cleared === 3) return 500 * level
  if (cleared === 4) return 800 * level
  return 0
}

function spawnNext(state: TetrisState): TetrisState {
  const current = createPiece(state.nextType)
  const nextType = randomType()
  const base = { ...state, current, nextType }
  if (collides(base.board, current)) return { ...base, status: 'gameover', recentClearCount: 0 }
  return base
}

export function moveHorizontal(state: TetrisState, dx: number): TetrisState {
  if (state.status !== 'playing') return state
  const candidate = { ...state.current, x: state.current.x + dx }
  if (collides(state.board, candidate)) return state
  return { ...state, current: candidate, recentClearCount: 0 }
}

export function rotateCurrent(state: TetrisState): TetrisState {
  if (state.status !== 'playing') return state
  const rotated = { ...state.current, rotation: (state.current.rotation + 1) % 4 }
  if (!collides(state.board, rotated)) return { ...state, current: rotated, recentClearCount: 0 }

  // 经典简易 wall kick：尝试左右挪 1 格
  const kickLeft = { ...rotated, x: rotated.x - 1 }
  if (!collides(state.board, kickLeft)) return { ...state, current: kickLeft, recentClearCount: 0 }
  const kickRight = { ...rotated, x: rotated.x + 1 }
  if (!collides(state.board, kickRight)) return { ...state, current: kickRight, recentClearCount: 0 }
  return state
}

export function softDrop(state: TetrisState): TetrisState {
  if (state.status !== 'playing') return state
  const candidate = { ...state.current, y: state.current.y + 1 }
  if (!collides(state.board, candidate)) return { ...state, current: candidate, recentClearCount: 0 }
  return lockPiece(state)
}

function lockPiece(state: TetrisState): TetrisState {
  const merged = mergePiece(state.board, state.current)
  const { board, cleared } = clearFullLines(merged)
  const newLines = state.lines + cleared
  const level = Math.min(20, Math.floor(newLines / 10) + 1)
  const score = state.score + pointsForLines(cleared, state.level)
  return spawnNext({ ...state, board, lines: newLines, level, score, recentClearCount: cleared })
}

export function hardDrop(state: TetrisState): TetrisState {
  if (state.status !== 'playing') return state
  let current = state.current
  while (!collides(state.board, { ...current, y: current.y + 1 })) {
    current = { ...current, y: current.y + 1 }
  }
  return lockPiece({ ...state, current, score: state.score + 2 })
}

export function togglePause(state: TetrisState): TetrisState {
  if (state.status === 'gameover') return state
  return { ...state, status: state.status === 'paused' ? 'playing' : 'paused', recentClearCount: 0 }
}

export function tick(state: TetrisState): TetrisState {
  return softDrop(state)
}

export function getRenderBoard(state: TetrisState): Board {
  const next = cloneBoard(state.board)
  const shape = getShape(state.current)
  const value = TYPE_VALUE[state.current.type]
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] === 0) continue
      const x = state.current.x + c
      const y = state.current.y + r
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) next[y][x] = value
    }
  }
  return next
}

export function getDropInterval(level: number): number {
  return Math.max(100, 700 - (level - 1) * 45)
}
