import { MATCH3_LEVELS } from './levels'
import {
  TILE_KINDS,
  type Cell,
  type GameLevel,
  type GameState,
  type MatchGroup,
  type Obstacle,
  type ObstacleKind,
  type Pos,
  type SpecialKind,
  type TileKind,
} from './types'

let cellSeq = 0

function nextId(): string {
  cellSeq += 1
  return `c${cellSeq}`
}

function posKey(p: Pos): string {
  return `${p.r},${p.c}`
}

function initialHp(kind: ObstacleKind): number {
  return kind === 'brickHard' ? 2 : 1
}

function makeObstacle(kind: ObstacleKind): Obstacle {
  return { id: nextId(), kind, hp: initialHp(kind) }
}

function cloneObstacles(obstacles: (Obstacle | null)[][]): (Obstacle | null)[][] {
  return obstacles.map((row) => row.map((o) => (o ? { ...o } : null)))
}

export function hasObstacle(state: GameState, r: number, c: number): boolean {
  return !!state.obstacles[r]?.[c]
}

export function getLevel(id: number): GameLevel {
  return MATCH3_LEVELS.find((l) => l.id === id) ?? MATCH3_LEVELS[0]!
}

export function kindsForLevel(level: GameLevel): TileKind[] {
  const n = Math.max(3, Math.min(level.kindCount, TILE_KINDS.length))
  return TILE_KINDS.slice(0, n)
}

function randomKind(kinds: readonly TileKind[]): TileKind {
  return kinds[Math.floor(Math.random() * kinds.length)]!
}

function makeCell(kind: TileKind, special: SpecialKind = 'none'): Cell {
  return { id: nextId(), kind, special }
}

function cloneBoard(board: (Cell | null)[][]): (Cell | null)[][] {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)))
}

function inBounds(board: (Cell | null)[][], r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < board.length && c < (board[0]?.length ?? 0)
}

function sameKind(a: Cell | null, b: Cell | null): boolean {
  return !!a && !!b && a.kind === b.kind
}

export function isAdjacent(a: Pos, b: Pos): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1
}

export function findMatches(board: (Cell | null)[][]): MatchGroup[] {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const groups: MatchGroup[] = []
  const seen = new Set<string>()
  const hRuns: { cells: Pos[]; kind: TileKind }[] = []
  const vRuns: { cells: Pos[]; kind: TileKind }[] = []

  const pushGroup = (cells: Pos[], kind: TileKind, special: SpecialKind, spawnAt?: Pos) => {
    if (cells.length < 3) return
    const key = cells
      .map((p) => `${p.r},${p.c}`)
      .sort()
      .join('|')
    if (seen.has(key)) return
    seen.add(key)
    const mid = spawnAt ?? cells[Math.floor(cells.length / 2)]!
    groups.push({ cells, kind, spawnAt: mid, special })
  }

  for (let r = 0; r < rows; r++) {
    let run: Pos[] = []
    let kind: TileKind | null = null
    for (let c = 0; c <= cols; c++) {
      const cell = c < cols ? board[r]![c]! : null
      if (cell && kind && cell.kind === kind) {
        run.push({ r, c })
      } else {
        if (run.length >= 3 && kind) hRuns.push({ cells: run, kind })
        if (cell) {
          kind = cell.kind
          run = [{ r, c }]
        } else {
          kind = null
          run = []
        }
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let run: Pos[] = []
    let kind: TileKind | null = null
    for (let r = 0; r <= rows; r++) {
      const cell = r < rows ? board[r]![c]! : null
      if (cell && kind && cell.kind === kind) {
        run.push({ r, c })
      } else {
        if (run.length >= 3 && kind) vRuns.push({ cells: run, kind })
        if (cell) {
          kind = cell.kind
          run = [{ r, c }]
        } else {
          kind = null
          run = []
        }
      }
    }
  }

  for (const run of hRuns) {
    const special: SpecialKind = run.cells.length >= 5 ? 'color' : run.cells.length === 4 ? 'lineH' : 'none'
    pushGroup(run.cells, run.kind, special)
  }
  for (const run of vRuns) {
    const special: SpecialKind = run.cells.length >= 5 ? 'color' : run.cells.length === 4 ? 'lineV' : 'none'
    pushGroup(run.cells, run.kind, special)
  }

  // 横竖同时 ≥3：L / T 交叉，在交点生成爆炸道具
  for (const h of hRuns) {
    for (const v of vRuns) {
      if (h.kind !== v.kind) continue
      const inter = h.cells.find((hp) => v.cells.some((vp) => vp.r === hp.r && vp.c === hp.c))
      if (!inter) continue
      const merged = new Map<string, Pos>()
      for (const p of h.cells) merged.set(`${p.r},${p.c}`, p)
      for (const p of v.cells) merged.set(`${p.r},${p.c}`, p)
      pushGroup([...merged.values()], h.kind, 'blast', inter)
    }
  }

  // 2×2 正方形
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = board[r]![c]
      const b = board[r]![c + 1]
      const d = board[r + 1]![c]
      const e = board[r + 1]![c + 1]
      if (!a || !b || !d || !e) continue
      if (a.kind !== b.kind || a.kind !== d.kind || a.kind !== e.kind) continue
      const cells: Pos[] = [
        { r, c },
        { r, c: c + 1 },
        { r: r + 1, c },
        { r: r + 1, c: c + 1 },
      ]
      pushGroup(cells, a.kind, 'blast', { r: r + 1, c: c + 1 })
    }
  }

  return groups
}

/** 玩家交换时：道具落在「移动后」的方块上（优先选中块的落点） */
function preferSpawnInGroup(cells: Pos[], fallback: Pos, focus?: Pos[]): Pos {
  if (!focus?.length) return fallback
  const inGroup = (p: Pos) => cells.some((c) => c.r === p.r && c.c === p.c)
  // focus 为 [选中格, 目标格]：选中块移动后在目标格
  for (let i = focus.length - 1; i >= 0; i--) {
    const p = focus[i]!
    if (inGroup(p)) return p
  }
  return fallback
}

function withSwapSpawnFocus(groups: MatchGroup[], focus?: Pos[]): MatchGroup[] {
  if (!focus?.length) return groups
  return groups.map((g) => {
    if (g.special === 'none') return g
    return { ...g, spawnAt: preferSpawnInGroup(g.cells, g.spawnAt, focus) }
  })
}

function hasAnyMatch(board: (Cell | null)[][]): boolean {
  return findMatches(board).length > 0
}

function parseLevelObstacles(level: GameLevel): (Obstacle | null)[][] {
  const grid: (Obstacle | null)[][] = Array.from({ length: level.rows }, () =>
    Array.from({ length: level.cols }, () => null),
  )
  const layout = level.layout
  if (!layout) return grid
  for (let r = 0; r < level.rows; r++) {
    const line = layout[r] ?? ''
    for (let c = 0; c < level.cols; c++) {
      const ch = line[c] ?? '.'
      if (ch === '#') grid[r]![c] = makeObstacle('brick')
      else if (ch === 'H' || ch === 'h') grid[r]![c] = makeObstacle('brickHard')
    }
  }
  return grid
}

function createFilledBoard(
  level: GameLevel,
  obstacles: (Obstacle | null)[][],
): (Cell | null)[][] {
  const kinds = kindsForLevel(level)
  return Array.from({ length: level.rows }, (_, r) =>
    Array.from({ length: level.cols }, (_, c) =>
      obstacles[r]![c] ? null : makeCell(randomKind(kinds)),
    ),
  )
}

export function createInitialState(levelId = MATCH3_LEVELS[0]!.id): GameState {
  const level = getLevel(levelId)
  const obstacles = parseLevelObstacles(level)
  return ensurePlayableBoard({
    levelId: level.id,
    board: createFilledBoard(level, obstacles),
    obstacles,
    score: 0,
    movesLeft: level.maxMoves,
    status: 'playing',
    selected: null,
    cascade: 0,
  })
}

export function restartLevel(state: GameState): GameState {
  return createInitialState(state.levelId)
}

export function goToLevel(levelId: number): GameState {
  return createInitialState(levelId)
}

function swapOnBoard(board: (Cell | null)[][], a: Pos, b: Pos): (Cell | null)[][] {
  const next = cloneBoard(board)
  const tmp = next[a.r]![a.c]!
  next[a.r]![a.c] = next[b.r]![b.c]!
  next[b.r]![b.c] = tmp
  return next
}

export function canSwap(
  board: (Cell | null)[][],
  a: Pos,
  b: Pos,
  obstacles?: (Obstacle | null)[][],
): boolean {
  if (!isAdjacent(a, b)) return false
  if (obstacles?.[a.r]?.[a.c] || obstacles?.[b.r]?.[b.c]) return false
  if (!board[a.r]?.[a.c] || !board[b.r]?.[b.c]) return false
  const swapped = swapOnBoard(board, a, b)
  const aCell = swapped[a.r]![a.c]
  const bCell = swapped[b.r]![b.c]
  // 特效块互换或任一特效参与交换也允许（激活）
  if (aCell?.special !== 'none' || bCell?.special !== 'none') return true
  return hasAnyMatch(swapped)
}

/** 是否存在可消除机会（已有匹配，或一次合法交换能形成匹配/激活道具） */
export function hasAnyValidMove(
  board: (Cell | null)[][],
  obstacles: (Obstacle | null)[][],
): boolean {
  if (hasAnyMatch(board)) return true
  const rows = board.length
  const cols = board[0]?.length ?? 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r]![c] || obstacles[r]?.[c]) continue
      for (const n of [
        { r, c: c + 1 },
        { r: r + 1, c },
      ]) {
        if (n.r >= rows || n.c >= cols) continue
        if (canSwap(board, { r, c }, n, obstacles)) return true
      }
    }
  }
  return false
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

/** 仅重排可玩格上的宝石（障碍不动）；尽量保证存在可消除步 */
export function reshuffleTiles(state: GameState, maxTries = 48): GameState {
  const rows = state.board.length
  const cols = state.board[0]?.length ?? 0
  const slots: Pos[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (state.obstacles[r]?.[c]) continue
      if (state.board[r]![c]) slots.push({ r, c })
    }
  }
  if (slots.length < 3) return state

  const level = getLevel(state.levelId)
  const kinds = kindsForLevel(level)

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const board = cloneBoard(state.board)
    if (attempt < maxTries / 2) {
      const cells = slots.map((p) => board[p.r]![p.c]!)
      shuffleInPlace(cells)
      for (let i = 0; i < slots.length; i++) {
        const p = slots[i]!
        board[p.r]![p.c] = cells[i]!
      }
    } else {
      for (const p of slots) {
        const prev = board[p.r]![p.c]!
        board[p.r]![p.c] = makeCell(randomKind(kinds), prev.special)
      }
      const cells = slots.map((p) => board[p.r]![p.c]!)
      shuffleInPlace(cells)
      for (let i = 0; i < slots.length; i++) {
        const p = slots[i]!
        board[p.r]![p.c] = cells[i]!
      }
    }
    if (hasAnyValidMove(board, state.obstacles)) {
      return { ...state, board, selected: null }
    }
  }

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const board = createFilledBoard(level, state.obstacles)
    if (hasAnyValidMove(board, state.obstacles)) {
      return { ...state, board, selected: null }
    }
  }
  return { ...state, board: createFilledBoard(level, state.obstacles), selected: null }
}

export function ensurePlayableBoard(state: GameState): GameState {
  if (hasAnyValidMove(state.board, state.obstacles)) return state
  return reshuffleTiles(state)
}

export function applySwap(state: GameState, a: Pos, b: Pos): GameState | null {
  if (state.status !== 'playing') return null
  if (!canSwap(state.board, a, b, state.obstacles)) return null
  return {
    ...state,
    board: swapOnBoard(state.board, a, b),
    movesLeft: state.movesLeft - 1,
    selected: null,
    cascade: 0,
  }
}

/** 周围爆炸：清除格本身或其四邻有障碍 → 障碍受击一次（每波最多 1） */
function applyObstacleHits(
  obstacles: (Obstacle | null)[][],
  clear: Set<string>,
): { obstacles: (Obstacle | null)[][]; destroyed: Pos[]; cracked: Pos[] } {
  const next = cloneObstacles(obstacles)
  const rows = next.length
  const cols = next[0]?.length ?? 0
  const hit = new Set<string>()

  for (const key of clear) {
    const [r, c] = key.split(',').map(Number) as [number, number]
    if (next[r]?.[c]) hit.add(key)
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      if (next[nr]![nc]) hit.add(`${nr},${nc}`)
    }
  }

  const destroyed: Pos[] = []
  const cracked: Pos[] = []
  for (const key of hit) {
    const [r, c] = key.split(',').map(Number) as [number, number]
    const obs = next[r]![c]
    if (!obs) continue
    const hp = obs.hp - 1
    if (hp <= 0) {
      next[r]![c] = null
      destroyed.push({ r, c })
    } else {
      next[r]![c] = { ...obs, hp }
      cracked.push({ r, c })
    }
  }
  return { obstacles: next, destroyed, cracked }
}

function collectClearSet(
  board: (Cell | null)[][],
  groups: MatchGroup[],
  colorTargets: { activator: Pos; clearKind: TileKind }[] = [],
  bonusClear: Iterable<string> = [],
): { clear: Set<string>; spawns: { pos: Pos; kind: TileKind; special: SpecialKind }[] } {
  const clear = new Set<string>()
  const spawns: { pos: Pos; kind: TileKind; special: SpecialKind }[] = []
  const posKey = (p: Pos) => `${p.r},${p.c}`

  for (const g of groups) {
    for (const p of g.cells) clear.add(posKey(p))
    if (g.special !== 'none') {
      spawns.push({ pos: g.spawnAt, kind: g.kind, special: g.special })
    }
  }

  for (const t of colorTargets) {
    clear.add(posKey(t.activator))
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < (board[0]?.length ?? 0); c++) {
        const cell = board[r]![c]
        if (cell && cell.kind === t.clearKind) clear.add(`${r},${c}`)
      }
    }
  }

  for (const key of bonusClear) clear.add(key)

  const queue: Pos[] = []
  for (const key of clear) {
    const [r, c] = key.split(',').map(Number) as [number, number]
    const cell = board[r]?.[c]
    if (cell && cell.special !== 'none' && cell.special !== 'color') queue.push({ r, c })
  }

  const activated = new Set<string>()
  while (queue.length) {
    const p = queue.shift()!
    const k = posKey(p)
    if (activated.has(k)) continue
    activated.add(k)
    const cell = board[p.r]?.[p.c]
    if (!cell || cell.special === 'none' || cell.special === 'color') continue

    const add = (r: number, c: number) => {
      if (!inBounds(board, r, c)) return
      const key = `${r},${c}`
      if (clear.has(key)) return
      clear.add(key)
      const other = board[r]![c]
      if (other && other.special !== 'none' && other.special !== 'color') queue.push({ r, c })
    }

    if (cell.special === 'lineH') {
      for (let c = 0; c < (board[0]?.length ?? 0); c++) add(p.r, c)
    } else if (cell.special === 'lineV') {
      for (let r = 0; r < board.length; r++) add(r, p.c)
    } else if (cell.special === 'blast') {
      addBlastPattern(add, p.r, p.c, 2, 1)
    }
  }

  return { clear, spawns }
}

function addBlastPattern(
  add: (r: number, c: number) => void,
  r: number,
  c: number,
  ortho: number,
  diag: number,
) {
  add(r, c)
  for (let d = 1; d <= ortho; d++) {
    add(r - d, c)
    add(r + d, c)
    add(r, c - d)
    add(r, c + d)
  }
  for (let d = 1; d <= diag; d++) {
    for (const dr of [-d, d]) {
      for (const dc of [-d, d]) add(r + dr, c + dc)
    }
  }
}

/**
 * 两个道具互换时的额外效果（叠在各自基础效果之上）
 * - 同向行列：清三行 / 三列
 * - 横+竖：双十字（两行两列）
 * - 爆炸×爆炸 / 变色×爆炸 / 行列×爆炸：超大爆炸
 * - 变色×变色：清空全场
 * - 变色×行列：再打通另一轴
 */
export function findSpecialSwapBonus(board: (Cell | null)[][], focus?: Pos[]): Set<string> {
  const bonus = new Set<string>()
  if (!focus || focus.length < 2) return bonus
  const [a, b] = focus
  if (!a || !b) return bonus
  const ca = board[a.r]?.[a.c]
  const cb = board[b.r]?.[b.c]
  if (!ca || !cb) return bonus
  if (ca.special === 'none' || cb.special === 'none') return bonus

  const rows = board.length
  const cols = board[0]?.length ?? 0
  const add = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return
    bonus.add(`${r},${c}`)
  }
  const addRow = (r: number) => {
    if (r < 0 || r >= rows) return
    for (let c = 0; c < cols; c++) add(r, c)
  }
  const addCol = (c: number) => {
    if (c < 0 || c >= cols) return
    for (let r = 0; r < rows; r++) add(r, c)
  }
  const mega = (p: Pos) => addBlastPattern(add, p.r, p.c, 3, 2)
  const sa = ca.special
  const sb = cb.special
  const isLine = (s: SpecialKind) => s === 'lineH' || s === 'lineV'

  if (sa === 'color' && sb === 'color') {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) add(r, c)
    }
    return bonus
  }

  if (sa === 'blast' && sb === 'blast') {
    mega(a)
    mega(b)
    return bonus
  }

  if (isLine(sa) && isLine(sb)) {
    if (sa === sb) {
      if (sa === 'lineH') {
        for (const r of new Set([a.r - 1, a.r, a.r + 1, b.r - 1, b.r, b.r + 1])) addRow(r)
      } else {
        for (const c of new Set([a.c - 1, a.c, a.c + 1, b.c - 1, b.c, b.c + 1])) addCol(c)
      }
    } else {
      addRow(a.r)
      addRow(b.r)
      addCol(a.c)
      addCol(b.c)
    }
    return bonus
  }

  if ((isLine(sa) && sb === 'blast') || (isLine(sb) && sa === 'blast')) {
    const linePos = isLine(sa) ? a : b
    const lineSp = isLine(sa) ? sa : sb
    const blastPos = sa === 'blast' ? a : b
    if (lineSp === 'lineH') {
      for (const r of [linePos.r - 1, linePos.r, linePos.r + 1]) addRow(r)
    } else {
      for (const c of [linePos.c - 1, linePos.c, linePos.c + 1]) addCol(c)
    }
    mega(blastPos)
    mega(linePos)
    return bonus
  }

  if ((sa === 'color' && isLine(sb)) || (sb === 'color' && isLine(sa))) {
    const colorPos = sa === 'color' ? a : b
    const lineSp = isLine(sa) ? sa : sb
    if (lineSp === 'lineH') addCol(colorPos.c)
    else addRow(colorPos.r)
    return bonus
  }

  if ((sa === 'color' && sb === 'blast') || (sb === 'color' && sa === 'blast')) {
    mega(a)
    mega(b)
    return bonus
  }

  return bonus
}

/** 五连变色道具：与交换对象的种类全消 */
export function findSwapColorClears(
  board: (Cell | null)[][],
  focus?: Pos[],
): { activator: Pos; clearKind: TileKind }[] {
  if (!focus || focus.length < 2) return []
  const [a, b] = focus
  if (!a || !b) return []
  const ca = board[a.r]?.[a.c]
  const cb = board[b.r]?.[b.c]
  if (!ca || !cb) return []
  const out: { activator: Pos; clearKind: TileKind }[] = []
  if (ca.special === 'color') out.push({ activator: a, clearKind: cb.kind })
  if (cb.special === 'color') out.push({ activator: b, clearKind: ca.kind })
  return out
}

/** 交换后激活两侧非变色特殊块（变色由 findSwapColorClears 处理） */
export function findActivationFromSpecials(board: (Cell | null)[][], focus?: Pos[]): MatchGroup[] {
  if (!focus?.length) return []
  const fake: MatchGroup[] = []
  for (const p of focus) {
    const cell = board[p.r]?.[p.c]
    if (!cell || cell.special === 'none' || cell.special === 'color') continue
    fake.push({
      cells: [p],
      kind: cell.kind,
      spawnAt: p,
      special: 'none',
    })
  }
  return fake
}

export function clearMatches(state: GameState, extraFocus?: Pos[]): {
  state: GameState
  cleared: Pos[]
  destroyedObstacles: Pos[]
} {
  const matches = withSwapSpawnFocus(findMatches(state.board), extraFocus)
  const specialActs = findActivationFromSpecials(state.board, extraFocus)
  const colorTargets = findSwapColorClears(state.board, extraFocus)
  const bonusClear = findSpecialSwapBonus(state.board, extraFocus)
  const groups = [...matches, ...specialActs]
  if (!groups.length && !colorTargets.length && bonusClear.size === 0) {
    return { state, cleared: [], destroyedObstacles: [] }
  }

  const { clear, spawns } = collectClearSet(state.board, groups, colorTargets, bonusClear)

  const {
    obstacles,
    destroyed: destroyedObstacles,
  } = applyObstacleHits(state.obstacles, clear)

  const board = cloneBoard(state.board)
  const cleared: Pos[] = []
  for (const key of clear) {
    const [r, c] = key.split(',').map(Number) as [number, number]
    if (state.obstacles[r]?.[c] && !destroyedObstacles.some((p) => p.r === r && p.c === c)) {
      continue
    }
    if (board[r]![c]) {
      board[r]![c] = null
      cleared.push({ r, c })
    }
  }
  for (const p of destroyedObstacles) {
    board[p.r]![p.c] = null
    if (!cleared.some((x) => x.r === p.r && x.c === p.c)) cleared.push(p)
  }

  for (const s of spawns) {
    const k = `${s.pos.r},${s.pos.c}`
    if (!clear.has(k)) continue
    if (obstacles[s.pos.r]?.[s.pos.c]) continue
    board[s.pos.r]![s.pos.c] = makeCell(s.kind, s.special)
  }

  const cascade = state.cascade + 1
  const brickBonus = destroyedObstacles.length * 40
  const gained = cleared.length * 10 * cascade + brickBonus
  return {
    state: {
      ...state,
      board,
      obstacles,
      score: state.score + gained,
      cascade,
      selected: null,
    },
    cleared,
    destroyedObstacles,
  }
}

/** 仅计算消除格，不改棋盘（用于先播特效）；含本波将被摧毁的砖 */
export function previewClear(state: GameState, extraFocus?: Pos[]): Pos[] {
  const matches = withSwapSpawnFocus(findMatches(state.board), extraFocus)
  const specialActs = findActivationFromSpecials(state.board, extraFocus)
  const colorTargets = findSwapColorClears(state.board, extraFocus)
  const bonusClear = findSpecialSwapBonus(state.board, extraFocus)
  const groups = [...matches, ...specialActs]
  if (!groups.length && !colorTargets.length && bonusClear.size === 0) return []
  const { clear } = collectClearSet(state.board, groups, colorTargets, bonusClear)
  const { destroyed } = applyObstacleHits(state.obstacles, clear)
  const out: Pos[] = []
  for (const key of clear) {
    const [r, c] = key.split(',').map(Number) as [number, number]
    if (state.board[r]?.[c]) out.push({ r, c })
  }
  for (const p of destroyed) {
    if (!out.some((x) => x.r === p.r && x.c === p.c)) out.push(p)
  }
  return out
}

export type FallMotion = {
  id: string
  fromR: number
  toR: number
  c: number
  /** 从棋盘上方新生 */
  spawn: boolean
}

export function collapseAndFill(state: GameState): { state: GameState; falls: FallMotion[] } {
  const level = getLevel(state.levelId)
  const kinds = kindsForLevel(level)
  const rows = state.board.length
  const cols = state.board[0]?.length ?? 0
  const prev = state.board
  const obstacles = state.obstacles
  const board: (Cell | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  )
  const falls: FallMotion[] = []

  for (let c = 0; c < cols; c++) {
    // 按障碍切段：障碍固定，段内宝石下落；障碍格保持为空
    const anchors: number[] = [-1]
    for (let r = 0; r < rows; r++) {
      if (obstacles[r]![c]) anchors.push(r)
    }
    anchors.push(rows)

    for (let ai = 0; ai < anchors.length - 1; ai++) {
      const top = anchors[ai]! + 1
      const bottom = anchors[ai + 1]! - 1
      if (top > bottom) continue

      const kept: { cell: Cell; fromR: number }[] = []
      for (let r = top; r <= bottom; r++) {
        const cell = prev[r]![c]
        if (cell) kept.push({ cell, fromR: r })
      }
      const slotCount = bottom - top + 1
      const empty = slotCount - kept.length
      const start = top + empty
      for (let i = 0; i < kept.length; i++) {
        const toR = start + i
        const { cell, fromR } = kept[i]!
        board[toR]![c] = cell
        if (toR !== fromR) {
          falls.push({ id: cell.id, fromR, toR, c, spawn: false })
        }
      }
      for (let i = 0; i < empty; i++) {
        const toR = top + i
        const cell = makeCell(randomKind(kinds))
        board[toR]![c] = cell
        falls.push({ id: cell.id, fromR: top - empty - 1 + i, toR, c, spawn: true })
      }
    }
  }

  return { state: { ...state, board }, falls }
}

export function settleStatus(state: GameState): GameState {
  const level = getLevel(state.levelId)
  if (state.score >= level.targetScore) {
    return { ...state, status: 'won', selected: null }
  }
  if (state.movesLeft <= 0) {
    return { ...state, status: 'lost', selected: null }
  }
  return state
}

export function selectCell(state: GameState, pos: Pos): GameState {
  if (state.status !== 'playing') return state
  if (state.obstacles[pos.r]?.[pos.c]) return state
  if (!state.board[pos.r]?.[pos.c]) return state
  if (!state.selected) return { ...state, selected: pos }
  if (state.selected.r === pos.r && state.selected.c === pos.c) {
    return { ...state, selected: null }
  }
  return { ...state, selected: pos }
}

export { sameKind, posKey }
