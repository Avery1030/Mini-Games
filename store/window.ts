import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  createDefaultWindows,
  getAppDefinition,
  type DesktopAppId,
  type DesktopWindowRuntime,
} from '@/config/desktop'
import { migrateLegacyDesktopPersist, WINDOWS_KEY } from '@/store/migrateLegacy'

const WINDOW_Z_BASE = 1000

type WindowsMap = Record<DesktopAppId, DesktopWindowRuntime>

interface WindowState {
  windows: WindowsMap
  topZIndex: number
  _hasHydrated: boolean
}

interface WindowActions {
  setHasHydrated: (value: boolean) => void
  openWindow: (id: DesktopAppId) => void
  closeWindow: (id: DesktopAppId) => void
  minimizeWindow: (id: DesktopAppId) => void
  focusWindow: (id: DesktopAppId) => void
  handleTaskbarClick: (id: DesktopAppId) => void
}

export type WindowStore = WindowState & WindowActions

function patchWindow(
  windows: WindowsMap,
  id: DesktopAppId,
  patch: Partial<DesktopWindowRuntime>,
): WindowsMap {
  return {
    ...windows,
    [id]: { ...windows[id], ...patch },
  }
}

function activateNext(windows: WindowsMap, excludeId: DesktopAppId): WindowsMap {
  const candidates = (Object.entries(windows) as [DesktopAppId, DesktopWindowRuntime][]).filter(
    ([id, w]) => id !== excludeId && w.isOpen,
  )
  const visible = candidates
    .filter(([, w]) => !w.minimized)
    .sort(([, a], [, b]) => b.zIndex - a.zIndex)
  const next = visible[0] ?? candidates.sort(([, a], [, b]) => b.zIndex - a.zIndex)[0]
  if (!next) {
    return Object.fromEntries(
      Object.entries(windows).map(([id, w]) => [id, { ...w, active: false }]),
    ) as WindowsMap
  }

  const nextId = next[0]
  return Object.fromEntries(
    Object.entries(windows).map(([id, w]) => [id, { ...w, active: id === nextId }]),
  ) as WindowsMap
}

function bringToFront(
  windows: WindowsMap,
  id: DesktopAppId,
  nextZ: number,
  patch?: Partial<Pick<DesktopWindowRuntime, 'isOpen' | 'minimized'>>,
): WindowsMap {
  return Object.fromEntries(
    Object.entries(windows).map(([appId, w]) => {
      if (appId !== id) return [appId, { ...w, active: false }]
      return [appId, { ...w, ...patch, active: true, zIndex: nextZ }]
    }),
  ) as WindowsMap
}

function getNextZ(windows: WindowsMap, topZIndex: number): number {
  const maxOpenZ = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
    (max, w) => (w.isOpen ? Math.max(max, w.zIndex) : max),
    WINDOW_Z_BASE,
  )
  return Math.max(topZIndex, maxOpenZ) + 1
}

function mergeWindows(
  saved?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>,
): WindowsMap {
  const defaults = createDefaultWindows()
  if (!saved) return defaults
  return Object.fromEntries(
    Object.entries(defaults).map(([id, fallback]) => {
      const s = saved[id as DesktopAppId]
      if (!s) return [id, fallback]
      return [
        id,
        {
          isOpen: s.isOpen ?? fallback.isOpen,
          minimized: s.minimized ?? fallback.minimized,
          active: s.active ?? fallback.active,
          zIndex: s.zIndex ?? fallback.zIndex,
        },
      ]
    }),
  ) as WindowsMap
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: createDefaultWindows(),
      topZIndex: WINDOW_Z_BASE,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      openWindow: (id) => {
        if (!getAppDefinition(id)?.app) return
        const { windows, topZIndex } = get()
        const nextZ = getNextZ(windows, topZIndex)
        set({
          topZIndex: nextZ,
          windows: bringToFront(windows, id, nextZ, { isOpen: true, minimized: false }),
        })
      },

      closeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target) return

        let next = patchWindow(windows, id, {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
        })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
      },

      minimizeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target?.isOpen) return

        let next = patchWindow(windows, id, { minimized: true, active: false })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
      },

      focusWindow: (id) => {
        const { windows, topZIndex } = get()
        const target = windows[id]
        if (!target?.isOpen || target.minimized) return
        if (target.active) return

        const nextZ = getNextZ(windows, topZIndex)
        set({
          topZIndex: nextZ,
          windows: bringToFront(windows, id, nextZ),
        })
      },

      /**
       * 任务栏点击（Windows 经典行为）：
       * - 已最小化 → 还原并激活
       * - 已激活且可见 → 最小化
       * - 可见但未激活 → 激活（置顶）
       */
      handleTaskbarClick: (id) => {
        const { windows, openWindow, minimizeWindow, focusWindow } = get()
        const target = windows[id]
        if (!target?.isOpen) return

        if (target.minimized) {
          openWindow(id)
          return
        }
        if (target.active) {
          minimizeWindow(id)
          return
        }
        focusWindow(id)
      },
    }),
    {
      name: WINDOWS_KEY,
      version: 1,
      storage: createJSONStorage(() => {
        migrateLegacyDesktopPersist()
        return localStorage
      }),
      partialize: (state) => ({
        windows: state.windows,
        topZIndex: state.topZIndex,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | { windows?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>; topZIndex?: number }
          | undefined
        return {
          ...current,
          windows: mergeWindows(saved?.windows),
          topZIndex: saved?.topZIndex ?? WINDOW_Z_BASE,
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
