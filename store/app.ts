import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type DesktopAppConfig,
  type DesktopAppId,
  type DesktopAppWindowState,
  mergeDesktopApps,
} from '@/config/desktop'

const WINDOW_Z_BASE = 1000

interface AppState {
  apps: DesktopAppConfig[]
  /** 全局递增，保证新聚焦的窗口始终在最上层 */
  topZIndex: number
  _hasHydrated: boolean
}

interface AppActions {
  setHasHydrated: (value: boolean) => void
  openWindow: (id: DesktopAppId) => void
  closeWindow: (id: DesktopAppId) => void
  minimizeWindow: (id: DesktopAppId) => void
  focusWindow: (id: DesktopAppId) => void
  handleTaskbarClick: (id: DesktopAppId) => void
}

export type AppStore = AppState & AppActions

function updateApp(
  apps: DesktopAppConfig[],
  id: DesktopAppId,
  patch: Partial<Pick<DesktopAppConfig, 'isOpen' | 'minimized' | 'active' | 'zIndex'>>,
): DesktopAppConfig[] {
  return apps.map((app) => (app.id === id ? { ...app, ...patch } : app))
}

/** 关闭/最小化后，把 active 交给下一个可见窗口（否则任意已打开窗口） */
function activateNext(apps: DesktopAppConfig[], excludeId: DesktopAppId): DesktopAppConfig[] {
  const candidates = apps.filter((app) => app.id !== excludeId && app.isOpen)
  const visible = candidates
    .filter((app) => !app.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)
  const next = visible[0] ?? candidates.sort((a, b) => b.zIndex - a.zIndex)[0]
  if (!next) return apps.map((app) => ({ ...app, active: false }))

  return apps.map((app) => ({
    ...app,
    active: app.id === next.id,
  }))
}

function bringToFront(
  apps: DesktopAppConfig[],
  id: DesktopAppId,
  nextZ: number,
  patch?: Partial<Pick<DesktopAppConfig, 'isOpen' | 'minimized'>>,
): DesktopAppConfig[] {
  return apps.map((app) => {
    if (app.id !== id) return { ...app, active: false }
    return {
      ...app,
      ...patch,
      active: true,
      zIndex: nextZ,
    }
  })
}

function getNextZ(apps: DesktopAppConfig[], topZIndex: number): number {
  const maxOpenZ = apps.reduce((max, app) => (app.isOpen ? Math.max(max, app.zIndex) : max), WINDOW_Z_BASE)
  return Math.max(topZIndex, maxOpenZ) + 1
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      apps: mergeDesktopApps(),
      topZIndex: WINDOW_Z_BASE,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      openWindow: (id) => {
        const { apps, topZIndex } = get()
        const target = apps.find((app) => app.id === id)
        if (!target?.app) return

        const nextZ = getNextZ(apps, topZIndex)
        set({
          topZIndex: nextZ,
          apps: bringToFront(apps, id, nextZ, { isOpen: true, minimized: false }),
        })
      },

      closeWindow: (id) => {
        const { apps } = get()
        const target = apps.find((app) => app.id === id)
        if (!target) return

        let next = updateApp(apps, id, { isOpen: false, minimized: false, active: false, zIndex: 0 })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ apps: next })
      },

      minimizeWindow: (id) => {
        const { apps } = get()
        const target = apps.find((app) => app.id === id)
        if (!target?.isOpen) return

        let next = updateApp(apps, id, { minimized: true, active: false })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ apps: next })
      },

      focusWindow: (id) => {
        const { apps, topZIndex } = get()
        const target = apps.find((app) => app.id === id)
        if (!target?.isOpen || target.minimized) return
        if (target.active) return

        const nextZ = getNextZ(apps, topZIndex)
        set({
          topZIndex: nextZ,
          apps: bringToFront(apps, id, nextZ),
        })
      },

      /**
       * 任务栏点击（Windows 经典行为）：
       * - 已最小化 → 还原并激活
       * - 已激活且可见 → 最小化
       * - 可见但未激活 → 激活（置顶）
       */
      handleTaskbarClick: (id) => {
        const { apps, openWindow, minimizeWindow, focusWindow } = get()
        const target = apps.find((app) => app.id === id)
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
      name: 'desktop-app-windows',
      partialize: (state): { apps: DesktopAppWindowState[]; topZIndex: number } => ({
        topZIndex: state.topZIndex,
        apps: state.apps.map(({ id, isOpen, minimized, active, zIndex }) => ({
          id,
          isOpen,
          minimized,
          active,
          zIndex,
        })),
      }),
      merge: (persisted, current) => {
        const saved = persisted as { apps?: DesktopAppWindowState[]; topZIndex?: number } | undefined
        return {
          ...current,
          apps: mergeDesktopApps(saved?.apps),
          topZIndex: saved?.topZIndex ?? WINDOW_Z_BASE,
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)
