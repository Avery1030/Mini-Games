import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { calcStars, type StarCount } from '@/features/games/sokoban/stars'

export type LevelProgress = {
  /** 历史最高星 */
  stars: StarCount
  /** 历史最少通关步数 */
  bestMoves: number
}

type SokobanProgressState = {
  /** key = levelId 字符串 */
  levels: Record<string, LevelProgress>
}

interface SokobanProgressActions {
  recordClear: (levelId: number, moves: number, minMoves: Nullable<number>) => StarCount
  getStars: (levelId: number) => number
  isUnlocked: (catalog: number[], levelId: number) => boolean
  nextUnlockedId: (catalog: number[], levelId: number) => Nullable<number>
}

export type SokobanProgressStore = SokobanProgressState & SokobanProgressActions

function isCleared(levels: Record<string, LevelProgress>, levelId: number): boolean {
  return (levels[String(levelId)]?.stars ?? 0) >= 1
}

export const useSokobanProgressStore = create<SokobanProgressStore>()(
  persist(
    (set, get) => ({
      levels: {},

      recordClear: (levelId, moves, minMoves) => {
        const earned = calcStars(moves, minMoves)
        const key = String(levelId)
        set((s) => {
          const prev = s.levels[key]
          const next: LevelProgress = {
            stars: Math.max(prev?.stars ?? 0, earned) as StarCount,
            bestMoves: prev ? Math.min(prev.bestMoves, moves) : moves,
          }
          return { levels: { ...s.levels, [key]: next } }
        })
        return earned
      },

      getStars: (levelId) => get().levels[String(levelId)]?.stars ?? 0,

      isUnlocked: (catalog, levelId) => {
        // TODO: 加关卡配置期间临时全开；完成后恢复为「通关上一关才解锁」
        if (catalog.indexOf(levelId) < 0) return false
        // return true
        const idx = catalog.indexOf(levelId)
        if (idx < 0) return false
        if (idx === 0) return true
        const prevId = catalog[idx - 1]
        return prevId != null && isCleared(get().levels, prevId)
      },

      nextUnlockedId: (catalog, levelId) => {
        const idx = catalog.indexOf(levelId)
        if (idx < 0) return null
        const nextId = catalog[idx + 1]
        if (nextId == null) return null
        return get().isUnlocked(catalog, nextId) ? nextId : null
      },
    }),
    {
      name: STORAGE_KEYS.sokoban,
      version: 1,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({ levels: s.levels }),
    },
  ),
)
