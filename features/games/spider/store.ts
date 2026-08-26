import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { cloneState, newGame } from './game'
import type { Difficulty, SpiderState } from './types'

const MAX_UNDO = 40

export type SpiderPersistState = {
  difficulty: Difficulty
  /** null 表示尚未开局（水合后 ensureGame 会补齐） */
  state: SpiderState | null
  undoStack: SpiderState[]
  elapsed: number
}

interface SpiderActions {
  ensureGame: () => SpiderState
  setDifficulty: (d: Difficulty) => void
  setGameState: (state: SpiderState) => void
  setUndoStack: (stack: SpiderState[] | ((prev: SpiderState[]) => SpiderState[])) => void
  pushUndo: (prev: SpiderState) => void
  setElapsed: (sec: number | ((prev: number) => number)) => void
  restart: (difficulty?: Difficulty) => void
}

export type SpiderStore = SpiderPersistState & SpiderActions

export const useSpiderStore = create<SpiderStore>()(
  persist(
    (set, get) => ({
      difficulty: 2,
      state: null,
      undoStack: [],
      elapsed: 0,

      ensureGame: () => {
        const cur = get().state
        if (cur) return cur

        const difficulty = get().difficulty
        const state = newGame(difficulty)
        set({ state, undoStack: [], elapsed: 0, difficulty })
        return state
      },

      setDifficulty: (difficulty) => set({ difficulty }),

      setGameState: (state) => set({ state: cloneState(state) }),

      setUndoStack: (stack) =>
        set((s) => ({
          undoStack: (typeof stack === 'function' ? stack(s.undoStack) : stack).map(cloneState).slice(-MAX_UNDO),
        })),

      pushUndo: (prev) =>
        set((s) => ({
          undoStack: [...s.undoStack, cloneState(prev)].slice(-MAX_UNDO),
        })),

      setElapsed: (sec) =>
        set((s) => ({
          elapsed: typeof sec === 'function' ? sec(s.elapsed) : sec,
        })),

      restart: (nextDiff) => {
        const difficulty = nextDiff ?? get().difficulty
        set({
          difficulty,
          state: newGame(difficulty),
          undoStack: [],
          elapsed: 0,
        })
      },
    }),
    {
      name: STORAGE_KEYS.spider,
      version: 1,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s): SpiderPersistState => ({
        difficulty: s.difficulty,
        state: s.state,
        undoStack: s.undoStack.slice(-MAX_UNDO),
        elapsed: s.elapsed,
      }),
    },
  ),
)
