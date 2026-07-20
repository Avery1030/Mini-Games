import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type DesktopAppId, type DesktopCoordinate } from '@/config/desktop'
import {
  createDefaultCoordinates,
  getDesktopAppDefinitionsSnapshot,
  registerDesktopCoordController,
} from '@/lib/desktop/window'
import { resolveOverlaps } from '@/lib/desktop'
import { STORAGE_KEYS, appStorage, migrateLegacyDesktopPersist } from '@/lib/storage'

type CoordinatesMap = Record<DesktopAppId, DesktopCoordinate>

interface DesktopState {
  coordinates: CoordinatesMap
  _hasHydrated: boolean
}

interface DesktopActions {
  setHasHydrated: (value: boolean) => void
  updateCoordinates: (updates: Array<{ id: DesktopAppId; coordinate: DesktopCoordinate }>) => void
  ensureCoordinate: (id: DesktopAppId, coordinate: DesktopCoordinate) => void
  removeCoordinate: (id: DesktopAppId) => void
}

export type DesktopStore = DesktopState & DesktopActions

function withUniqueCoordinates(coordinates: CoordinatesMap): CoordinatesMap {
  const unique = resolveOverlaps(new Map(Object.entries(coordinates) as [DesktopAppId, DesktopCoordinate][]))
  return Object.fromEntries([...unique.entries()]) as CoordinatesMap
}

function mergeCoordinates(
  saved?: Partial<Record<DesktopAppId, DesktopCoordinate>>,
): CoordinatesMap {
  const defaults = createDefaultCoordinates()
  const defs = getDesktopAppDefinitionsSnapshot()
  const merged: CoordinatesMap = { ...defaults }
  for (const def of defs) {
    if (!merged[def.id]) merged[def.id] = [...def.defaultCoordinate] as DesktopCoordinate
  }
  if (saved) {
    for (const [id, coord] of Object.entries(saved)) {
      if (Array.isArray(coord) && coord.length === 2) {
        merged[id] = coord as DesktopCoordinate
      }
    }
  }
  return withUniqueCoordinates(merged)
}

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set) => ({
      coordinates: withUniqueCoordinates(createDefaultCoordinates()),
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      updateCoordinates: (updates) => {
        if (updates.length === 0) return
        const map = new Map(updates.map((item) => [item.id, item.coordinate]))
        set((state) =>
          ({
            coordinates: withUniqueCoordinates(
              Object.fromEntries(
                Object.entries(state.coordinates).map(([id, coord]) => [
                  id,
                  map.get(id as DesktopAppId) ?? coord,
                ]),
              ) as CoordinatesMap,
            ),
          }),
        )
      },

      ensureCoordinate: (id, coordinate) => {
        set((state) => {
          if (state.coordinates[id]) {
            return {
              coordinates: withUniqueCoordinates({
                ...state.coordinates,
              }),
            }
          }
          return {
            coordinates: withUniqueCoordinates({
              ...state.coordinates,
              [id]: coordinate,
            }),
          }
        })
      },

      removeCoordinate: (id) => {
        set((state) => {
          if (!state.coordinates[id]) return state
          const { [id]: _removed, ...rest } = state.coordinates
          return { coordinates: withUniqueCoordinates(rest as CoordinatesMap) }
        })
      },
    }),
    {
      name: STORAGE_KEYS.coordinates,
      version: 1,
      storage: createJSONStorage(() =>
        appStorage.createStateStorage({ before: () => migrateLegacyDesktopPersist() }),
      ),
      partialize: (state) => ({
        coordinates: state.coordinates,
      }),
      merge: (persisted, current) => {
        const saved = persisted as { coordinates?: Partial<Record<DesktopAppId, DesktopCoordinate>> } | undefined
        return {
          ...current,
          coordinates: mergeCoordinates(saved?.coordinates),
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

registerDesktopCoordController({
  ensureCoordinate: (id, coordinate) => useDesktopStore.getState().ensureCoordinate(id, coordinate),
  removeCoordinate: (id) => useDesktopStore.getState().removeCoordinate(id),
})
