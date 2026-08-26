import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

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
      name: STORAGE_KEYS.notepad,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({ lastNoteId: s.lastNoteId, wordWrap: s.wordWrap }),
    },
  ),
)
