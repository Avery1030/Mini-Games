import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { parseOfficePersist, type OfficePersist } from './schema'
import { migrateOfficeFilesToVfs } from './vfsApi'

interface OfficeActions {
  setHasHydrated: (value: boolean) => void
  setLastOpened: (kind: 'writer' | 'sheet', id: Nullable<string>) => void
}

export type OfficeStore = OfficePersist & { _hasHydrated: boolean } & OfficeActions

export const useOfficeStore = create<OfficeStore>()(
  persist(
    (set) => ({
      files: [],
      lastWriterId: null,
      lastSheetId: null,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      setLastOpened: (kind, id) => {
        if (kind === 'writer') set({ lastWriterId: id })
        else set({ lastSheetId: id })
      },
    }),
    {
      name: STORAGE_KEYS.office,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        files: s.files,
        lastWriterId: s.lastWriterId,
        lastSheetId: s.lastSheetId,
      }),
      merge: (persisted, current) => {
        const parsed = parseOfficePersist(persisted)
        if (!parsed) return current
        return { ...current, ...parsed }
      },
      onRehydrateStorage: () => (state, error) => {
        void (async () => {
          try {
            if (error || !state?.files.length) return
            const mapped = await migrateOfficeFilesToVfs(state.files, state.lastWriterId, state.lastSheetId)
            useOfficeStore.setState({ files: [], ...mapped })
          } finally {
            useOfficeStore.getState().setHasHydrated(true)
          }
        })()
      },
    },
  ),
)
