import { useEffect, useRef, useState } from 'react'
import { createStateFromLevel } from './game'
import { solveMinMovesAsync } from './solver'
import type { LevelData } from './types'

/** 异步求解当前关开局最少步数 */
export function useMinMoves(levelId: number | null, level: LevelData | null | undefined) {
  const [minMoves, setMinMoves] = useState<number | null>(null)
  const [minMovesReady, setMinMovesReady] = useState(false)
  const cacheRef = useRef<Map<string, number>>(new Map())

  const mapKey = level?.map.join('\n') ?? null

  useEffect(() => {
    if (levelId == null || !mapKey || !level) {
      setMinMoves(null)
      setMinMovesReady(false)
      return
    }
    const cacheKey = `${levelId}:${mapKey}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached != null) {
      setMinMoves(cached)
      setMinMovesReady(true)
      return
    }

    setMinMoves(null)
    setMinMovesReady(false)
    const ac = new AbortController()
    const initial = createStateFromLevel(levelId, level)
    void solveMinMovesAsync(initial, { signal: ac.signal }).then((path) => {
      if (ac.signal.aborted) return
      if (path == null) {
        setMinMoves(null)
        setMinMovesReady(true)
        return
      }
      cacheRef.current.set(cacheKey, path.length)
      setMinMoves(path.length)
      setMinMovesReady(true)
    })
    return () => ac.abort()
  }, [levelId, mapKey, level])

  const clearCache = () => cacheRef.current.clear()

  return { minMoves, minMovesReady, clearCache }
}
