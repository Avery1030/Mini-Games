import {
  DEFAULT_WINDOW_RUNTIME,
  type DesktopAppDefinition,
  type DesktopAppId,
  type DesktopCoordinate,
  type DesktopWindowRuntime,
} from '@/config/desktop'
import { ensureWindowSlot, removeWindowSlot, type DesktopWindow } from './DesktopWindow'

type RegistryListener = () => void

/**
 * 内置窗口列表：由 builtins.ts → registerBuiltinApps → pushBuiltinWindow 填充。
 * 新增应用：在 builtins.ts 追加一条配置即可。
 */
const builtinWindows: DesktopWindow[] = []
const builtinIdSet = new Set<string>()

const dynamicWindows = new Map<DesktopAppId, DesktopWindow>()
const windowMap = new Map<DesktopAppId, DesktopWindow>()
const listeners = new Set<RegistryListener>()

let definitionsSnapshot: DesktopAppDefinition[] = []
let windowsSnapshot: DesktopWindow[] = []

function rebuildSnapshots() {
  windowsSnapshot = [...builtinWindows, ...dynamicWindows.values()]
  definitionsSnapshot = windowsSnapshot.map((w) => w.toDefinition())
}

function notify() {
  rebuildSnapshots()
  for (const listener of listeners) listener()
}

/**
 * 注册内置窗口（启动期由 registerBuiltinApp 调用）。
 * 成功返回 true；id 冲突返回 false。
 */
export function pushBuiltinWindow(win: DesktopWindow): boolean {
  if (windowMap.has(win.id)) return false
  builtinWindows.push(win)
  builtinIdSet.add(win.id)
  windowMap.set(win.id, win)
  notify()
  return true
}

/** 是否为已注册的内置应用 id（不含动态文件夹/文稿） */
export function isBuiltinAppId(id: string): boolean {
  return builtinIdSet.has(id)
}

export function subscribeDesktopRegistry(listener: RegistryListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** useSyncExternalStore 用：列表引用在变更时才会换 */
export function getDesktopAppDefinitionsSnapshot(): DesktopAppDefinition[] {
  return definitionsSnapshot
}

export function getDesktopAppDefinitions(): DesktopAppDefinition[] {
  return definitionsSnapshot
}

export function getDesktopWindowsSnapshot(): DesktopWindow[] {
  return windowsSnapshot
}

/** 全部窗口实例（内置 + 动态） */
export function listDesktopWindows(): DesktopWindow[] {
  return windowsSnapshot
}

/** 内置窗口列表（与 builtinWindows 同引用，加载期会增长） */
export const DESKTOP_WINDOWS: readonly DesktopWindow[] = builtinWindows

type DesktopCoordController = {
  ensureCoordinate: (id: DesktopAppId, coordinate: DesktopCoordinate) => void
  removeCoordinate: (id: DesktopAppId) => void
}

let coordController: DesktopCoordController | null = null

export function registerDesktopCoordController(next: DesktopCoordController) {
  coordController = next
}

export function getDesktopWindow(id: DesktopAppId): DesktopWindow | undefined {
  return windowMap.get(id)
}

export function getAppDefinition(id: DesktopAppId): DesktopAppDefinition | undefined {
  return windowMap.get(id)?.toDefinition()
}

export type RegisterDesktopWindowOptions = {
  /** 图标落点；省略则用窗口 defaultCoordinate（并由桌面 store 消解冲突） */
  coordinate?: DesktopCoordinate
  /**
   * 是否同步写入 window / desktop store 槽位。
   * ensure 幂等，水合恢复时也可为 true。
   */
  syncStores?: boolean
  /**
   * 是否写入桌面坐标。嵌套在文件夹内的项应为 false。
   * 仅在 syncStores !== false 时生效，默认 true。
   */
  placeOnDesktop?: boolean
}

/**
 * 运行时注册窗口实例（文件夹等）。
 * 成功后通知订阅者，并可选同步 window/coordinate store。
 */
export function registerDesktopWindow(
  win: DesktopWindow,
  options: RegisterDesktopWindowOptions = {},
): boolean {
  if (windowMap.has(win.id)) return false
  dynamicWindows.set(win.id, win)
  windowMap.set(win.id, win)
  notify()

  if (options.syncStores !== false) {
    ensureWindowSlot(win.id)
    if (options.placeOnDesktop !== false) {
      const coord = options.coordinate ?? win.defaultCoordinate
      coordController?.ensureCoordinate(win.id, coord)
    }
  }
  return true
}

/** 注销动态窗口（内置不可注销） */
export function unregisterDesktopWindow(id: DesktopAppId, options?: { close?: boolean }): boolean {
  if (!dynamicWindows.has(id)) return false
  const win = dynamicWindows.get(id)
  if (options?.close !== false) {
    try {
      win?.close()
    } catch {
      // store 未就绪时忽略
    }
  }
  dynamicWindows.delete(id)
  windowMap.delete(id)
  notify()

  try {
    removeWindowSlot(id)
  } catch {
    // ignore
  }
  coordController?.removeCoordinate(id)
  return true
}

export function isDynamicDesktopWindow(id: DesktopAppId): boolean {
  return dynamicWindows.has(id)
}

export function createDefaultWindows(): Record<DesktopAppId, DesktopWindowRuntime> {
  const list = [...builtinWindows, ...dynamicWindows.values()]
  return Object.fromEntries(list.map((w) => [w.id, { ...DEFAULT_WINDOW_RUNTIME }])) as Record<
    DesktopAppId,
    DesktopWindowRuntime
  >
}

export function createDefaultCoordinates(): Record<DesktopAppId, DesktopCoordinate> {
  const list = [...builtinWindows, ...dynamicWindows.values()]
  return Object.fromEntries(
    list.map((w) => [w.id, [...w.defaultCoordinate] as DesktopCoordinate]),
  ) as Record<DesktopAppId, DesktopCoordinate>
}

/** 刷新某窗口的 definition 快照（例如 rename 后） */
export function refreshDesktopWindow(id: DesktopAppId): void {
  if (!windowMap.has(id)) return
  notify()
}
