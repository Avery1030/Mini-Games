import type { DesktopAppDefinition, DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import { isBuiltinAppId } from '@/config/desktop'
import { FolderWindow } from './apps'
import {
  registerDesktopWindow,
  refreshDesktopWindow,
  unregisterDesktopWindow,
  listDesktopWindows,
} from './registry'
import { coordKey } from '@/lib/desktop/layout'

export type CreateDesktopFolderOptions = {
  title?: string
  coordinate?: DesktopCoordinate
  /** 创建后是否立刻打开，默认 false */
  open?: boolean
}

function nextFolderId(): DesktopAppId {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : `${Date.now().toString(36)}`
  return `folder_${rand}`
}

function normalizeFolderTitle(title: string): string {
  return title.trim().toLowerCase()
}

/** 文件夹名称是否已被占用（大小写不敏感）；excludeId 用于重命名时忽略自身 */
export function isFolderTitleTaken(title: string, excludeId?: DesktopAppId): boolean {
  const key = normalizeFolderTitle(title)
  if (!key) return false
  return listDesktopWindows().some(
    (w) =>
      w.kind === 'folder' &&
      w.id !== excludeId &&
      normalizeFolderTitle(w.title ?? '') === key,
  )
}

function defaultFolderTitle(existingTitles: string[], base: string): string {
  const taken = new Set(existingTitles.map((t) => normalizeFolderTitle(t)))
  const normalizedBase = normalizeFolderTitle(base)
  if (!taken.has(normalizedBase)) return base.trim() || base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.trim()} (${n})`
    if (!taken.has(normalizeFolderTitle(candidate))) return candidate
  }
  return `${base.trim()} (${Date.now()})`
}

/**
 * 在桌面创建一个可打开的文件夹图标 + 窗口实例。
 * 持久化由 desktopItems store 承接（调用方应同时写入，或用 store 的 createFolder）。
 */
export function createDesktopFolderWindow(options: CreateDesktopFolderOptions = {}): FolderWindow | null {
  const id = nextFolderId()
  const existingTitles = listDesktopWindows()
    .filter((w) => w.kind === 'folder')
    .map((w) => w.title ?? '')
  const title = defaultFolderTitle(existingTitles, options.title?.trim() || '新建文件夹')
  const win = new FolderWindow({
    id,
    title,
    coordinate: options.coordinate,
  })
  const ok = registerDesktopWindow(win, { coordinate: options.coordinate })
  if (!ok) return null
  if (options.open) win.open()
  return win
}

export function removeDesktopFolderWindow(id: DesktopAppId): boolean {
  return unregisterDesktopWindow(id)
}

export function renameDesktopFolderWindow(id: DesktopAppId, title: string): boolean {
  const trimmed = title.trim()
  if (!trimmed) return false
  if (isFolderTitleTaken(trimmed, id)) return false
  const win = listDesktopWindows().find((w) => w.id === id)
  if (!(win instanceof FolderWindow)) return false
  win.rename(trimmed)
  refreshDesktopWindow(id)
  return true
}

/** 解析图标/窗口显示名：动态 title 优先，内置走 i18n */
export function resolveDesktopItemTitle(
  app: Pick<DesktopAppDefinition, 'id' | 'title'>,
  tApps: (key: string) => string,
): string {
  if (app.title && app.title.trim()) return app.title.trim()
  if (isBuiltinAppId(app.id)) return tApps(app.id)
  return app.id
}

/** 根据已占用格点分配空位；优先 prefer，冲突则从该点向外找最近空位 */
export function allocateDesktopCoordinate(
  occupied: Iterable<DesktopCoordinate>,
  prefer: DesktopCoordinate = [4, 1],
): DesktopCoordinate {
  const taken = new Set([...occupied].map((c) => coordKey(c)))
  const from: DesktopCoordinate = [Math.max(1, prefer[0]), Math.max(1, prefer[1])]
  if (!taken.has(coordKey(from))) return from

  for (let radius = 1; radius < 64; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
        const next: DesktopCoordinate = [Math.max(1, from[0] + dc), Math.max(1, from[1] + dr)]
        if (!taken.has(coordKey(next))) return next
      }
    }
  }
  return [from[0] + 1, from[1]]
}
