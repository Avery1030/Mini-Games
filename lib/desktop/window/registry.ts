import {
  DEFAULT_WINDOW_RUNTIME,
  type DesktopAppDefinition,
  type DesktopAppId,
  type DesktopCoordinate,
  type DesktopWindowRuntime,
} from '@/config/desktop'
import { ensureWindowSlot, removeWindowSlot, type DesktopWindow } from './DesktopWindow'
import {
  BridgeWindow,
  CalculatorWindow,
  ClaimWindow,
  DocumentWindow,
  DonationWindow,
  EmailWindow,
  FoundryWindow,
  GovernanceWindow,
  LogWindow,
  MarketWindow,
  MinesweeperWindow,
  MusicWindow,
  NotepadWindow,
  PaintWindow,
  ReferralWindow,
  SettingsWindow,
  StakeWindow,
  TetrisWindow,
} from './apps'

type RegistryListener = () => void

/**
 * 内置窗口单例（启动时固定）。
 * 新增内置应用：写子类 → 加入此数组 → messages 里加 apps.id。
 */
const BUILTIN_WINDOWS: DesktopWindow[] = [
  new ReferralWindow(),
  new BridgeWindow(),
  new ClaimWindow(),
  new StakeWindow(),
  new MarketWindow(),
  new MinesweeperWindow(),
  new TetrisWindow(),
  new GovernanceWindow(),
  new FoundryWindow(),
  new DocumentWindow(),
  new DonationWindow(),
  new EmailWindow(),
  new LogWindow(),
  new NotepadWindow(),
  new PaintWindow(),
  new SettingsWindow(),
  new MusicWindow(),
  new CalculatorWindow(),
]

const dynamicWindows = new Map<DesktopAppId, DesktopWindow>()
const windowMap = new Map<DesktopAppId, DesktopWindow>(BUILTIN_WINDOWS.map((w) => [w.id, w]))
const listeners = new Set<RegistryListener>()

let definitionsSnapshot: DesktopAppDefinition[] = BUILTIN_WINDOWS.map((w) => w.toDefinition())
let windowsSnapshot: DesktopWindow[] = [...BUILTIN_WINDOWS]

function rebuildSnapshots() {
  windowsSnapshot = [...BUILTIN_WINDOWS, ...dynamicWindows.values()]
  definitionsSnapshot = windowsSnapshot.map((w) => w.toDefinition())
  // 兼容仍引用可变导出的旧代码
  DESKTOP_APP_DEFINITIONS.length = 0
  DESKTOP_APP_DEFINITIONS.push(...definitionsSnapshot)
}

function notify() {
  rebuildSnapshots()
  for (const listener of listeners) listener()
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

/** 内置窗口列表（只读） */
export const DESKTOP_WINDOWS: readonly DesktopWindow[] = BUILTIN_WINDOWS

/** 可变导出：始终与最新快照同步（push/splice 原地更新） */
export const DESKTOP_APP_DEFINITIONS: DesktopAppDefinition[] = [...definitionsSnapshot]

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
    const coord = options.coordinate ?? win.defaultCoordinate
    coordController?.ensureCoordinate(win.id, coord)
  }
  return true
}

/** 注销动态窗口（内置不可注销） */
export function unregisterDesktopWindow(id: DesktopAppId): boolean {
  if (!dynamicWindows.has(id)) return false
  const win = dynamicWindows.get(id)
  try {
    win?.close()
  } catch {
    // store 未就绪时忽略
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
  const list = [...BUILTIN_WINDOWS, ...dynamicWindows.values()]
  return Object.fromEntries(list.map((w) => [w.id, { ...DEFAULT_WINDOW_RUNTIME }])) as Record<
    DesktopAppId,
    DesktopWindowRuntime
  >
}

export function createDefaultCoordinates(): Record<DesktopAppId, DesktopCoordinate> {
  const list = [...BUILTIN_WINDOWS, ...dynamicWindows.values()]
  return Object.fromEntries(
    list.map((w) => [w.id, [...w.defaultCoordinate] as DesktopCoordinate]),
  ) as Record<DesktopAppId, DesktopCoordinate>
}

/** 刷新某窗口的 definition 快照（例如 rename 后） */
export function refreshDesktopWindow(id: DesktopAppId): void {
  if (!windowMap.has(id)) return
  notify()
}
