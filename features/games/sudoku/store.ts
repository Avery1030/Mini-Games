import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { progressKey, type Difficulty } from '@/features/games/sudoku/types'
import {
  DEFAULT_SUDOKU_SETTINGS,
  normalizeSudokuSettings,
  type SudokuSettingKey,
  type SudokuSettings,
} from '@/features/games/sudoku/settings'

export type LevelProgress = {
  /** 历史最短通关用时（秒） */
  bestTime: number
}

type SudokuProgressState = {
  /** key = `${difficulty}:${levelId}` */
  levels: Record<string, LevelProgress>
  settings: SudokuSettings
}

interface SudokuProgressActions {
  recordClear: (difficulty: Difficulty, levelId: number, elapsedSec: number) => void
  setSetting: <K extends SudokuSettingKey>(key: K, value: SudokuSettings[K]) => void
  isUnlocked: (difficulty: Difficulty, catalog: number[], levelId: number) => boolean
}

export type SudokuProgressStore = SudokuProgressState & SudokuProgressActions

export const useSudokuProgressStore = create<SudokuProgressStore>()(
  persist(
    (set, get) => ({
      levels: {},
      settings: { ...DEFAULT_SUDOKU_SETTINGS },

      recordClear: (difficulty, levelId, elapsedSec) => {
        const key = progressKey(difficulty, levelId)
        const time = Math.max(0, Math.floor(elapsedSec))
        set((s) => {
          const prev = s.levels[key]
          const next: LevelProgress = {
            bestTime: prev ? Math.min(prev.bestTime, time) : time,
          }
          return { levels: { ...s.levels, [key]: next } }
        })
      },

      setSetting: (key, value) => {
        set((s) => ({ settings: { ...s.settings, [key]: value } }))
      },

      isUnlocked: (difficulty, catalog, levelId) => {
        const idx = catalog.indexOf(levelId)
        if (idx < 0) return false
        if (idx === 0) return true
        const prevId = catalog[idx - 1]
        return prevId != null && get().levels[progressKey(difficulty, prevId)] != null
      },
    }),
    {
      name: STORAGE_KEYS.sudoku,
      version: 3,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({ levels: s.levels, settings: s.settings }),
      migrate: (persisted) => {
        const state = persisted as {
          levels?: Record<string, { stars?: number; bestTime?: number }>
          settings?: unknown
        }
        const levels: Record<string, LevelProgress> = {}
        if (state?.levels) {
          for (const [key, entry] of Object.entries(state.levels)) {
            if (entry == null || typeof entry.bestTime !== 'number') continue
            levels[key] = { bestTime: entry.bestTime }
          }
        }
        return {
          levels,
          settings: normalizeSudokuSettings(state?.settings),
        }
      },
    },
  ),
)
