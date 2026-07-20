import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DesktopAppId, DesktopWindowRuntime, WindowBounds } from '@/config/desktop'
import { DEFAULT_WINDOW_RUNTIME } from '@/config/desktop'
import {
  createDefaultWindows,
  getDesktopWindow,
  registerWindowController,
} from '@/lib/desktop/window'
import { STORAGE_KEYS, appStorage, migrateLegacyDesktopPersist } from '@/lib/storage'

const WINDOW_Z_BASE = 1000

type WindowsMap = Record<DesktopAppId, DesktopWindowRuntime>

interface WindowState {
  windows: WindowsMap
  topZIndex: number
  /** 下一个新打开窗口的任务栏序号 */
  nextOpenOrder: number
  _hasHydrated: boolean
}

interface WindowActions {
  setHasHydrated: (value: boolean) => void
  openWindow: (id: DesktopAppId) => void
  closeWindow: (id: DesktopAppId) => void
  closeAllWindows: () => void
  minimizeWindow: (id: DesktopAppId) => void
  /** 最小化所有已打开且可见的窗口 */
  minimizeAllWindows: () => void
  /** 记忆窗口位置/尺寸（关闭后仍保留） */
  updateWindowBounds: (id: DesktopAppId, bounds: WindowBounds) => void
  focusWindow: (id: DesktopAppId) => void
  handleTaskbarClick: (id: DesktopAppId) => void
  /** 动态注册时确保有运行时槽位 */
  ensureWindow: (id: DesktopAppId) => void
  /** 动态注销时移除运行时槽位 */
  removeWindow: (id: DesktopAppId) => void
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
  patch?: Partial<Pick<DesktopWindowRuntime, 'isOpen' | 'minimized' | 'openOrder'>>,
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

function normalizeBounds(raw: unknown): WindowBounds | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<WindowBounds>
  if (
    typeof b.x !== 'number' ||
    typeof b.y !== 'number' ||
    typeof b.width !== 'number' ||
    typeof b.height !== 'number'
  ) {
    return null
  }
  return {
    x: b.x,
    y: b.y,
    width: Math.max(200, b.width),
    height: Math.max(150, b.height),
    maximized: b.maximized === true,
  }
}

function mergeWindows(
  saved?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>,
): WindowsMap {
  const defaults = createDefaultWindows()
  const known = new Set(Object.keys(defaults))
  const ids = new Set<string>([...known])
  for (const id of Object.keys(saved ?? {})) {
    if (known.has(id) || id.startsWith('folder_')) ids.add(id)
  }
  return Object.fromEntries(
    [...ids].map((id) => {
      const fallback = defaults[id] ?? { ...DEFAULT_WINDOW_RUNTIME }
      const s = saved?.[id]
      if (!s) return [id, fallback]
      return [
        id,
        {
          isOpen: s.isOpen ?? fallback.isOpen,
          minimized: s.minimized ?? fallback.minimized,
          active: s.active ?? fallback.active,
          zIndex: s.zIndex ?? fallback.zIndex,
          openOrder: s.openOrder ?? (s.isOpen ? s.zIndex ?? fallback.openOrder : 0),
          bounds: normalizeBounds(s.bounds) ?? fallback.bounds,
        },
      ]
    }),
  ) as WindowsMap
}

/** 重置开关状态时保留各窗记忆几何（含动态窗口） */
function resetOpenStateKeepBounds(windows: WindowsMap): WindowsMap {
  return Object.fromEntries(
    Object.entries(windows).map(([id, w]) => [
      id,
      {
        ...DEFAULT_WINDOW_RUNTIME,
        bounds: w.bounds ?? null,
      },
    ]),
  ) as WindowsMap
}

function nextOrderFromWindows(windows: WindowsMap, nextOpenOrder: number): number {
  const maxOrder = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
    (max, w) => (w.isOpen ? Math.max(max, w.openOrder) : max),
    0,
  )
  return Math.max(nextOpenOrder, maxOrder + 1)
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: createDefaultWindows(),
      topZIndex: WINDOW_Z_BASE,
      nextOpenOrder: 1,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      openWindow: (id) => {
        const deskWin = getDesktopWindow(id)
        if (!deskWin?.app) return
        if (!deskWin.onBeforeOpen()) return
        const { windows, topZIndex, nextOpenOrder } = get()
        const nextZ = getNextZ(windows, topZIndex)
        const wasClosed = !windows[id]?.isOpen
        const openOrder = wasClosed ? nextOrderFromWindows(windows, nextOpenOrder) : windows[id].openOrder
        set({
          topZIndex: nextZ,
          nextOpenOrder: wasClosed ? openOrder + 1 : nextOpenOrder,
          windows: bringToFront(windows, id, nextZ, {
            isOpen: true,
            minimized: false,
            ...(wasClosed ? { openOrder } : {}),
          }),
        })
        deskWin.onAfterOpen()
      },

      closeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target) return
        const deskWin = getDesktopWindow(id)
        if (deskWin && !deskWin.onBeforeClose()) return

        // 关闭时保留 bounds，供下次打开恢复
        let next = patchWindow(windows, id, {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
          openOrder: 0,
        })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
        deskWin?.onAfterClose()
      },

      closeAllWindows: () => {
        const { windows } = get()
        set({
          windows: resetOpenStateKeepBounds(windows),
          topZIndex: WINDOW_Z_BASE,
          nextOpenOrder: 1,
        })
      },

      updateWindowBounds: (id, bounds) => {
        const { windows } = get()
        if (!windows[id]) return
        const next = normalizeBounds(bounds)
        if (!next) return
        set({ windows: patchWindow(windows, id, { bounds: next }) })
      },

      minimizeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target?.isOpen) return
        const deskWin = getDesktopWindow(id)
        if (deskWin && !deskWin.onBeforeMinimize()) return

        let next = patchWindow(windows, id, { minimized: true, active: false })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
        deskWin?.onAfterMinimize()
      },

      minimizeAllWindows: () => {
        const { windows } = get()
        let changed = false
        const next = { ...windows }
        for (const id of Object.keys(next) as DesktopAppId[]) {
          const w = next[id]
          if (!w?.isOpen || w.minimized) continue
          next[id] = { ...w, minimized: true, active: false }
          changed = true
        }
        if (changed) set({ windows: next })
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

      ensureWindow: (id) => {
        const { windows } = get()
        if (windows[id]) return
        set({ windows: { ...windows, [id]: { ...DEFAULT_WINDOW_RUNTIME } } })
      },

      removeWindow: (id) => {
        const { windows } = get()
        if (!windows[id]) return
        const { [id]: _removed, ...rest } = windows
        set({ windows: rest as WindowsMap })
      },
    }),
    {
      name: STORAGE_KEYS.windows,
      version: 2,
      storage: createJSONStorage(() =>
        appStorage.createStateStorage({ before: () => migrateLegacyDesktopPersist() }),
      ),
      partialize: (state) => ({
        windows: state.windows,
        topZIndex: state.topZIndex,
        nextOpenOrder: state.nextOpenOrder,
      }),
      merge: (persisted, current) => {
        const saved = persisted as
          | {
              windows?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>
              topZIndex?: number
              nextOpenOrder?: number
            }
          | undefined
        const windows = mergeWindows(saved?.windows)
        const maxOrder = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
          (max, w) => Math.max(max, w.openOrder),
          0,
        )
        return {
          ...current,
          windows,
          topZIndex: saved?.topZIndex ?? WINDOW_Z_BASE,
          nextOpenOrder: Math.max(saved?.nextOpenOrder ?? 1, maxOrder + 1),
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

registerWindowController({
  openWindow: (id) => useWindowStore.getState().openWindow(id),
  closeWindow: (id) => useWindowStore.getState().closeWindow(id),
  minimizeWindow: (id) => useWindowStore.getState().minimizeWindow(id),
  focusWindow: (id) => useWindowStore.getState().focusWindow(id),
  getRuntime: (id) => useWindowStore.getState().windows[id],
  ensureWindow: (id) => useWindowStore.getState().ensureWindow(id),
  removeWindow: (id) => useWindowStore.getState().removeWindow(id),
})

