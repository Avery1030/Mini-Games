import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createDefaultCoordinates,
  DESKTOP_APP_DEFINITIONS,
  type DesktopAppId,
  type DesktopCoordinate,
} from '@/config/desktop'
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
}

export type DesktopStore = DesktopState & DesktopActions

function withUniqueCoordinates(coordinates: CoordinatesMap): CoordinatesMap {
  const unique = resolveOverlaps(new Map(Object.entries(coordinates) as [DesktopAppId, DesktopCoordinate][]))
  return Object.fromEntries(
    DESKTOP_APP_DEFINITIONS.map((app) => [app.id, unique.get(app.id) ?? coordinates[app.id] ?? app.defaultCoordinate]),
  ) as CoordinatesMap
}

function mergeCoordinates(
  saved?: Partial<Record<DesktopAppId, DesktopCoordinate>>,
): CoordinatesMap {
  const defaults = createDefaultCoordinates()
  if (!saved) return withUniqueCoordinates(defaults)
  return withUniqueCoordinates({
    ...defaults,
    ...Object.fromEntries(
      Object.entries(saved).filter(([, coord]) => Array.isArray(coord) && coord.length === 2),
    ),
  } as CoordinatesMap)
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
