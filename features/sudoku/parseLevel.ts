import type { Difficulty, LevelData, LevelJsonEntry } from './types'
import { DIFFICULTIES } from './types'
import { solveUnique } from './solver'
import { SUDOKU_LEVELS_BY_DIFFICULTY } from './levels'

const SIZE = 9

function parseDigitRow(row: string, allowDot: boolean): number[] {
  if (row.length !== SIZE) {
    throw new Error(`[sudoku] row length must be ${SIZE}, got ${row.length}`)
  }
  const out: number[] = []
  for (let i = 0; i < SIZE; i++) {
    const ch = row[i]!
    if (allowDot && (ch === '.' || ch === ' ')) {
      out.push(0)
      continue
    }
    const n = Number(ch)
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      throw new Error(`[sudoku] invalid digit '${ch}'`)
    }
    out.push(n)
  }
  return out
}

/** 解析单关：校验题目并求解唯一解 */
export function parseLevel(entry: LevelJsonEntry, difficulty: Difficulty): LevelData {
  if (entry.puzzle.length !== SIZE) {
    throw new Error(`[sudoku] ${difficulty}#${entry.id} must have ${SIZE} rows`)
  }
  const puzzle = entry.puzzle.map((row) => parseDigitRow(row, true))
  let clues = 0
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (puzzle[r]![c] !== 0) clues++
    }
  }
  const solution = solveUnique(puzzle)
  if (!solution) {
    throw new Error(`[sudoku] ${difficulty}#${entry.id} has no unique solution`)
  }
  const minMoves = SIZE * SIZE - clues
  return { id: entry.id, difficulty, puzzle, solution, clues, minMoves }
}

export type LoadedLevels = {
  /** difficulty -> id -> LevelData */
  byDifficulty: Record<Difficulty, Map<number, LevelData>>
  /** 各难度关卡 id 列表（已排序） */
  catalogs: Record<Difficulty, number[]>
}

export function loadAllLevels(
  tables: Record<Difficulty, LevelJsonEntry[]> = SUDOKU_LEVELS_BY_DIFFICULTY,
): LoadedLevels {
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, new Map<number, LevelData>()])) as Record<
    Difficulty,
    Map<number, LevelData>
  >
  const catalogs = Object.fromEntries(DIFFICULTIES.map((d) => [d, [] as number[]])) as Record<Difficulty, number[]>

  for (const d of DIFFICULTIES) {
    for (const entry of tables[d]) {
      try {
        const level = parseLevel(entry, d)
        if (byDifficulty[d].has(level.id)) {
          console.warn(`[sudoku] duplicate id ${d}#${level.id}, skip`)
          continue
        }
        byDifficulty[d].set(level.id, level)
      } catch (err) {
        console.warn('[sudoku] skip invalid level', d, entry?.id, err)
      }
    }
    catalogs[d] = [...byDifficulty[d].keys()].sort((a, b) => a - b)
  }

  return { byDifficulty, catalogs }
}

export function getLevel(bundle: LoadedLevels, difficulty: Difficulty, id: number): LevelData | undefined {
  return bundle.byDifficulty[difficulty].get(id)
}
