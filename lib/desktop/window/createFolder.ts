import type { DesktopAppDefinition, DesktopAppId, DesktopCoordinate, DesktopItemKind } from '@/config/desktop'
import { isBuiltinAppId } from '@/config/desktop'
import { FolderWindow, TextDocumentWindow } from './apps'
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
  /** 同级已有标题，用于生成不重名名称 */
  siblingTitles?: string[]
  /** 是否落在桌面格点；嵌套项为 false */
  placeOnDesktop?: boolean
  /** 创建后是否立刻打开，默认 false */
  open?: boolean
}

export type CreateDesktopTextDocumentOptions = {
  title?: string
  coordinate?: DesktopCoordinate
  siblingTitles?: string[]
  placeOnDesktop?: boolean
  /** 对应记事本 note id */
  noteId: string
  open?: boolean
}

function nextId(prefix: 'folder' | 'text'): DesktopAppId {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : `${Date.now().toString(36)}`
  return `${prefix}_${rand}`
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase()
}

function defaultUniqueTitle(existingTitles: string[], base: string): string {
  const taken = new Set(existingTitles.map((t) => normalizeTitle(t)))
  const normalizedBase = normalizeTitle(base)
  if (!taken.has(normalizedBase)) return base.trim() || base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.trim()} (${n})`
    if (!taken.has(normalizeTitle(candidate))) return candidate
  }
  return `${base.trim()} (${Date.now()})`
}

/**
 * 在桌面 / 文件夹内创建一个可打开的文件夹窗口实例。
 * 持久化由 desktopItems store 承接。
 */
export function createDesktopFolderWindow(options: CreateDesktopFolderOptions = {}): FolderWindow | null {
  const id = nextId('folder')
  const existingTitles =
    options.siblingTitles ??
    listDesktopWindows()
      .filter((w) => w.kind === 'folder')
      .map((w) => w.title ?? '')
  const title = defaultUniqueTitle(existingTitles, options.title?.trim() || '新建文件夹')
  const win = new FolderWindow({
    id,
    title,
    coordinate: options.coordinate,
  })
  const placeOnDesktop = options.placeOnDesktop !== false
  const ok = registerDesktopWindow(win, {
    coordinate: options.coordinate,
    placeOnDesktop,
  })
  if (!ok) return null
  if (options.open) win.open()
  return win
}

export function createDesktopTextDocumentWindow(
  options: CreateDesktopTextDocumentOptions,
): TextDocumentWindow | null {
  const id = nextId('text')
  const existingTitles =
    options.siblingTitles ??
    listDesktopWindows()
      .filter((w) => w.kind === 'textDocument')
      .map((w) => w.title ?? '')
  const title = defaultUniqueTitle(existingTitles, options.title?.trim() || '新建文本文档')
  const win = new TextDocumentWindow({
    id,
    title,
    noteId: options.noteId,
    coordinate: options.coordinate,
  })
  const placeOnDesktop = options.placeOnDesktop !== false
  const ok = registerDesktopWindow(win, {
    coordinate: options.coordinate,
    placeOnDesktop,
  })
  if (!ok) return null
  if (options.open) win.open()
  return win
}

export function removeDesktopFolderWindow(id: DesktopAppId): boolean {
  return unregisterDesktopWindow(id)
}

export function removeDesktopItemWindow(id: DesktopAppId): boolean {
  return unregisterDesktopWindow(id)
}

/** @deprecated 使用 renameDesktopItemWindow */
export function renameDesktopFolderWindow(id: DesktopAppId, title: string): boolean {
  return renameDesktopItemWindow(id, 'folder', title)
}

export function renameDesktopItemWindow(
  id: DesktopAppId,
  kind: Extract<DesktopItemKind, 'folder' | 'textDocument'>,
  title: string,
): boolean {
  const trimmed = title.trim()
  if (!trimmed) return false
  const win = listDesktopWindows().find((w) => w.id === id)
  if (kind === 'folder') {
    if (!(win instanceof FolderWindow)) return false
    win.rename(trimmed)
  } else {
    if (!(win instanceof TextDocumentWindow)) return false
    win.rename(trimmed)
  }
  refreshDesktopWindow(id)
  return true
}

/**
 * @deprecated 名称唯一性请用 lib/desktop/itemsTree.isSiblingTitleTaken
 * 保留兼容：全局同 kind 窗口标题检测
 */
export function isDesktopItemTitleTaken(
  kind: Extract<DesktopItemKind, 'folder' | 'textDocument'>,
  title: string,
  excludeId?: DesktopAppId,
): boolean {
  const key = normalizeTitle(title)
  if (!key) return false
  return listDesktopWindows().some(
    (w) =>
      w.kind === kind &&
      w.id !== excludeId &&
      normalizeTitle(w.title ?? '') === key,
  )
}

/** @deprecated */
export function isFolderTitleTaken(title: string, excludeId?: DesktopAppId): boolean {
  return isDesktopItemTitleTaken('folder', title, excludeId)
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
