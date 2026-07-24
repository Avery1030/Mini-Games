import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { type DesktopAppId, type DesktopCoordinate } from '@/config/desktop'
import {
  createDefaultCoordinates,
  getDesktopAppDefinitionsSnapshot,
  registerDesktopCoordController,
} from '@/lib/desktop/window'
import { resolveOverlaps, arrangeIcons, type ArrangeAlign } from '@/lib/desktop'
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
  /** 依次重排桌面图标（列优先向下；可靠左或靠右） */
  rearrangeIcons: (
    ids: DesktopAppId[],
    options?: { maxRows?: number; align?: ArrangeAlign; maxCols?: number },
  ) => void
}

export type DesktopStore = DesktopState & DesktopActions

function withUniqueCoordinates(
  coordinates: CoordinatesMap,
  priorityId?: DesktopAppId,
): CoordinatesMap {
  const unique = resolveOverlaps(
    new Map(Object.entries(coordinates) as [DesktopAppId, DesktopCoordinate][]),
    priorityId,
  )
  return Object.fromEntries([...unique.entries()]) as CoordinatesMap
}

function mergeCoordinates(
  saved?: Partial<Record<DesktopAppId, DesktopCoordinate>>,
): CoordinatesMap {
  const defaults = createDefaultCoordinates()
  const defs = getDesktopAppDefinitionsSnapshot()
  const known = new Set(defs.map((d) => d.id))
  const merged: CoordinatesMap = { ...defaults }
  for (const def of defs) {
    if (!merged[def.id]) merged[def.id] = [...def.defaultCoordinate] as DesktopCoordinate
  }
  if (saved) {
    for (const [id, coord] of Object.entries(saved)) {
      // 保留当前内置应用 + 动态文件夹；丢弃已下线演示应用坐标
      if (!known.has(id as DesktopAppId) && !id.startsWith('folder_')) continue
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
        set((state) => {
          const next = { ...state.coordinates } as CoordinatesMap
          for (const { id, coordinate } of updates) {
            next[id] = coordinate
          }
          // 拖拽项优先占目标格，其它图标让位（否则新文件夹等会被挤回「到不了的位置」）
          const priorityId = updates[0]?.id
          return { coordinates: withUniqueCoordinates(next, priorityId) }
        })
      },

      ensureCoordinate: (id, coordinate) => {
        set((state) => {
          if (state.coordinates[id]) {
            return { coordinates: withUniqueCoordinates(state.coordinates) }
          }
          return {
            coordinates: withUniqueCoordinates(
              { ...state.coordinates, [id]: coordinate } as CoordinatesMap,
              id,
            ),
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

      rearrangeIcons: (ids, options) => {
        if (ids.length === 0) return
        const updates = arrangeIcons(ids, options)
        set((state) => {
          const next = { ...state.coordinates } as CoordinatesMap
          for (const { id, coordinate } of updates) {
            next[id] = coordinate
          }
          return { coordinates: withUniqueCoordinates(next) }
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
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as { coordinates?: unknown }
        const coordinates =
          raw.coordinates && typeof raw.coordinates === 'object' && !Array.isArray(raw.coordinates)
            ? (raw.coordinates as Partial<Record<DesktopAppId, DesktopCoordinate>>)
            : {}
        return { coordinates }
      },
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
