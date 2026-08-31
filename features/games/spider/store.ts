import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { cloneState, newGame } from './game'
import { emptyRecords, insertRecord, normalizeRecords, type RecordWinResult, type SpiderRecordsMap } from './records'
import { Difficulty, type SpiderState, type SpiderTimeRecord, isDifficulty } from './types'

const MAX_UNDO = 40

export type SpiderPersistState = {
  difficulty: Difficulty
  /** null 表示尚未开局（水合后 ensureGame 会补齐） */
  state: Nullable<SpiderState>
  undoStack: SpiderState[]
  elapsed: number
  records: SpiderRecordsMap
  /** 本局胜利是否已写入排行榜，避免重开已通关对局重复入榜 */
  winLogged: boolean
}

interface SpiderActions {
  ensureGame: () => SpiderState
  setDifficulty: (d: Difficulty) => void
  setGameState: (state: SpiderState) => void
  setUndoStack: (stack: SpiderState[] | ((prev: SpiderState[]) => SpiderState[])) => void
  pushUndo: (prev: SpiderState) => void
  setElapsed: (sec: number | ((prev: number) => number)) => void
  restart: (difficulty?: Difficulty) => void
  recordWin: (entry: { difficulty: Difficulty; elapsed: number; moves: number; score: number }) => Nullable<RecordWinResult>
  /** 撤销通关后允许再次入榜 */
  clearWinLogged: () => void
}

export type SpiderStore = SpiderPersistState & SpiderActions

function persistSlice(s: SpiderStore): SpiderPersistState {
  return {
    difficulty: s.difficulty,
    state: s.state,
    undoStack: s.undoStack.slice(-MAX_UNDO),
    elapsed: s.elapsed,
    records: s.records,
    winLogged: s.winLogged,
  }
}

export const useSpiderStore = create<SpiderStore>()(
  persist(
    (set, get) => ({
      difficulty: Difficulty.TwoSuit,
      state: null,
      undoStack: [],
      elapsed: 0,
      records: emptyRecords(),
      winLogged: false,

      ensureGame: () => {
        const cur = get().state
        if (cur) return cur

        const difficulty = get().difficulty
        const state = newGame(difficulty)
        set({ state, undoStack: [], elapsed: 0, difficulty, winLogged: false })
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
          winLogged: false,
        })
      },

      recordWin: (entry) => {
        if (get().winLogged) return null
        const next: SpiderTimeRecord = {
          elapsed: Math.max(0, Math.floor(entry.elapsed)),
          moves: Math.max(0, Math.floor(entry.moves)),
          score: Math.max(0, Math.floor(entry.score)),
          at: Date.now(),
        }
        const prev = get().records[entry.difficulty] ?? []
        const result = insertRecord(prev, next)
        set((s) => ({
          winLogged: true,
          records: { ...s.records, [entry.difficulty]: result.records },
        }))
        return result
      },

      clearWinLogged: () => set({ winLogged: false }),
    }),
    {
      name: STORAGE_KEYS.spider,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: persistSlice,
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as Partial<SpiderPersistState>
        return {
          difficulty: isDifficulty(raw.difficulty) ? raw.difficulty : Difficulty.TwoSuit,
          state: raw.state ?? null,
          undoStack: Array.isArray(raw.undoStack) ? raw.undoStack : [],
          elapsed: typeof raw.elapsed === 'number' ? raw.elapsed : 0,
          records: normalizeRecords(raw.records),
          winLogged: Boolean(raw.winLogged),
        }
      },
    },
  ),
)
