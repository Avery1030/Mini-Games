import type { LevelData } from './types'
import { normalizeLevelData } from './parseLevel'
import { SOKOBAN_LEVELS } from './levels'

export type LoadedLevels = {
  ids: number[]
  byId: Map<number, LevelData>
}

let cache: LoadedLevels | null = null

/** 解析内置关卡（多行 ASCII）；结果缓存 */
export async function fetchAllLevels(): Promise<LoadedLevels> {
  if (cache) return cache

  if (!Array.isArray(SOKOBAN_LEVELS) || SOKOBAN_LEVELS.length === 0) {
    throw new Error('[sokoban] levels empty')
  }

  const ids: number[] = []
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
      ids.push(entry.id)
      byId.set(entry.id, level)
    } catch (err) {
      console.warn('[sokoban] skip unparsable level', entry.id, err)
    }
  }

  if (ids.length === 0) {
    throw new Error('[sokoban] no valid levels')
  }

  cache = { ids, byId }
  return cache
}
