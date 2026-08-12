import type { LevelData, LevelJsonEntry } from './types'
import { normalizeLevelData } from './parseLevel'
import { SOKOBAN_LEVELS } from './levels'

export type LoadedLevels = {
  ids: number[]
  byId: Map<number, LevelData>
}

let cache: LoadedLevels | null = null

function parseLevels(entries: readonly LevelJsonEntry[]): LoadedLevels {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('[sokoban] levels empty')
  }

  const ids: number[] = []
  const byId = new Map<number, LevelData>()

  for (const entry of entries) {
    if (typeof entry?.id !== 'number' || !Array.isArray(entry.map) || entry.map.length === 0) {
      console.warn('[sokoban] skip invalid entry', entry?.id)
      continue
    }
    if (!entry.map.every((row: string) => typeof row === 'string')) {
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

  return { ids, byId }
}

/** 解析内置关卡（多行 ASCII）；结果缓存 */
export async function fetchAllLevels(): Promise<LoadedLevels> {
  if (cache) return cache
  cache = parseLevels(SOKOBAN_LEVELS)
  return cache
}

/** 清空缓存并重新读取 / 解析 SOKOBAN_LEVELS（编辑 levels.ts 后点刷新） */
export async function reloadAllLevels(): Promise<LoadedLevels> {
  cache = null
  const { SOKOBAN_LEVELS: fresh } = await import('./levels')
  cache = parseLevels(fresh)
  return cache
}
