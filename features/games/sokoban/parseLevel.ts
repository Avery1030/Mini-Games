import type { CellPos, LevelData } from './types'

/**
 * 地图字符（经典 Sokoban）：
 * `#` 墙 · ` ` 空地 · `@` 玩家 · `+` 玩家在目标上
 * `$` 箱子 · `*` 箱子在目标上 · `.` 目标点
 *
 * 解析后保证：恰 1 名玩家、箱子数 = 目标数、各行等宽。
 */

function isBlankCell(ch: string): boolean {
  return ch === ' ' || ch === '-' || ch === '_'
}

function normalizeMapRows(map: string[]): string[] {
  const width = Math.max(0, ...map.map((row) => row.length))
  return map.map((row) => row.padEnd(width, ' '))
}

/** 裁掉四周纯空白，得到覆盖墙/玩家/箱子/目标的最小矩形 */
function cropMapRows(map: string[]): string[] {
  const rows = normalizeMapRows(map)
  if (rows.length === 0) return rows

  const height = rows.length
  const width = rows[0]?.length ?? 0

  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const row = rows[y]
    for (let x = 0; x < width; x++) {
      if (!isBlankCell(row[x] ?? ' ')) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error('[sokoban] map has no content')
  }

  return rows.slice(minY, maxY + 1).map((row) => row.slice(minX, maxX + 1))
}

function parseMapStrings(map: string[]): {
  map: string[]
  width: number
  height: number
  playerStart: CellPos
  boxes: CellPos[]
  targets: CellPos[]
  walls: CellPos[]
  voids: CellPos[]
} {
  if (map.length === 0) {
    throw new Error('[sokoban] empty map')
  }

  const rows = cropMapRows(map)
  const height = rows.length
  const width = rows[0]?.length ?? 0

  const walls: CellPos[] = []
  const boxes: CellPos[] = []
  const targets: CellPos[] = []
  let playerStart: Nullable<CellPos> = null
  const wallGrid = Array.from({ length: height }, () => Array<boolean>(width).fill(false))

  for (let y = 0; y < height; y++) {
    const row = rows[y]
    for (let x = 0; x < width; x++) {
      const ch = row[x]
      switch (ch) {
        case '#':
          walls.push({ x, y })
          wallGrid[y][x] = true
          break
        case '@':
          playerStart = { x, y }
          break
        case '+':
          playerStart = { x, y }
          targets.push({ x, y })
          break
        case '$':
          boxes.push({ x, y })
          break
        case '*':
          boxes.push({ x, y })
          targets.push({ x, y })
          break
        case '.':
          targets.push({ x, y })
          break
        default:
          break
      }
    }
  }

  if (!playerStart) {
    throw new Error('[sokoban] map missing player (@)')
  }
  if (boxes.length === 0) {
    throw new Error('[sokoban] map missing boxes ($)')
  }
  if (targets.length === 0) {
    throw new Error('[sokoban] map missing targets (.)')
  }
  if (boxes.length !== targets.length) {
    throw new Error(`[sokoban] boxes (${boxes.length}) != targets (${targets.length})`)
  }

  const voids = findExteriorVoids(wallGrid, width, height, playerStart)

  return { map: rows, width, height, playerStart, boxes, targets, walls, voids }
}

/**
 * 外侧空地：从地图边缘经非墙格洪水填充，但排除玩家可达区域。
 */
function findExteriorVoids(
  wallGrid: boolean[][],
  width: number,
  height: number,
  playerStart: CellPos,
): CellPos[] {
  const fromBorder = floodNonWalls(wallGrid, width, height, borderSeeds(wallGrid, width, height))
  const playable = floodNonWalls(wallGrid, width, height, [playerStart])

  const voids: CellPos[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = `${x},${y}`
      if (fromBorder.has(k) && !playable.has(k)) {
        voids.push({ x, y })
      }
    }
  }
  return voids
}

function borderSeeds(wallGrid: boolean[][], width: number, height: number): CellPos[] {
  const seeds: CellPos[] = []
  const add = (x: number, y: number) => {
    if (!wallGrid[y][x]) seeds.push({ x, y })
  }
  for (let x = 0; x < width; x++) {
    add(x, 0)
    add(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    add(0, y)
    add(width - 1, y)
  }
  return seeds
}

function floodNonWalls(
  wallGrid: boolean[][],
  width: number,
  height: number,
  seeds: CellPos[],
): Set<string> {
  const seen = new Set<string>()
  const queue: CellPos[] = []

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    if (wallGrid[y][x]) return
    const k = `${x},${y}`
    if (seen.has(k)) return
    seen.add(k)
    queue.push({ x, y })
  }

  for (const s of seeds) tryEnqueue(s.x, s.y)

  while (queue.length > 0) {
    const { x, y } = queue.pop()!
    tryEnqueue(x + 1, y)
    tryEnqueue(x - 1, y)
    tryEnqueue(x, y + 1)
    tryEnqueue(x, y - 1)
  }

  return seen
}

/** 以 map 字符串为准解析并生成完整 LevelData */
export function normalizeLevelData(input: { map: string[] }): LevelData {
  const parsed = parseMapStrings(input.map)
  return {
    map: parsed.map,
    width: parsed.width,
    height: parsed.height,
    playerStart: parsed.playerStart,
    boxes: parsed.boxes,
    targets: parsed.targets,
    walls: parsed.walls,
    voids: parsed.voids,
  }
}
