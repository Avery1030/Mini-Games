import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const NOTEPAD_KEY = 'desktop-notepad'

type NotepadState = {
  /** 上次打开的笔记 id（用于恢复） */
  lastNoteId: string | null
  /** 是否自动换行 */
  wordWrap: boolean
  setLastNoteId: (id: string | null) => void
  setWordWrap: (value: boolean) => void
}

export const useNotepadStore = create<NotepadState>()(
  persist(
    (set) => ({
      lastNoteId: null,
      wordWrap: true,
      setLastNoteId: (id) => set({ lastNoteId: id }),
      setWordWrap: (value) => set({ wordWrap: value }),
    }),
    {
      name: NOTEPAD_KEY,
      partialize: (s) => ({ lastNoteId: s.lastNoteId, wordWrap: s.wordWrap }),
    },
  ),
)
