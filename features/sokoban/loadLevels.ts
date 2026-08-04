import type { LevelData, LevelJsonEntry } from './types'
import { normalizeLevelData } from './parseLevel'
import { SOKOBAN_LEVELS } from './levels'

export type LoadedLevels = {
  entries: LevelJsonEntry[]
  byId: Map<number, LevelData>
}

let cache: LoadedLevels | null = null

/** 解析内置关卡（多行 ASCII）；结果缓存 */
export async function fetchAllLevels(): Promise<LoadedLevels> {
  if (cache) return cache

  if (!Array.isArray(SOKOBAN_LEVELS) || SOKOBAN_LEVELS.length === 0) {
    throw new Error('[sokoban] levels empty')
  }

  const entries: LevelJsonEntry[] = []
  const byId = new Map<number, LevelData>()

  for (const entry of SOKOBAN_LEVELS) {
    if (typeof entry?.id !== 'number' || !Array.isArray(entry.map) || entry.map.length === 0) {
      console.warn('[sokoban] skip invalid entry', entry?.id)
      continue
    }
    if (!entry.map.every((row) => typeof row === 'string')) {
      console.warn('[sokoban] skip non-string map rows', entry.id)
      continue
    }
    try {
      const level = normalizeLevelData({ map: entry.map })
      const normalizedEntry: LevelJsonEntry = {
        id: entry.id,
        map: level.map,
      }
      entries.push(normalizedEntry)
      byId.set(entry.id, level)
    } catch (err) {
      console.warn('[sokoban] skip unparsable level', entry.id, err)
    }
  }

  if (entries.length === 0) {
    throw new Error('[sokoban] no valid levels')
  }

  cache = { entries, byId }
  return cache
}

export function getLevelById(bundle: LoadedLevels, id: number): LevelData | undefined {
  return bundle.byId.get(id)
}

/** 测试或热更新时可清空缓存 */
export function clearLevelsCache(): void {
  cache = null
}
