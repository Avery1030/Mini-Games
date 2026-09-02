import { ScrollText, Table2 } from 'lucide-react'
import type { ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import { createWindowIdSuffix } from '@/lib/id'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { DesktopWindow } from './DesktopWindow'
import { createDeferredApp, type DeferredApp } from './defineApp'
import {
  getDesktopWindow,
  listDesktopWindows,
  refreshDesktopWindow,
  registerDesktopWindow,
  unregisterDesktopWindow,
} from './registry'
import type { OfficeKind } from '@/features/office/schema'

type AppHost = ComponentType

export type OfficeSessionPersist = {
  id: string
  kind: OfficeKind
  fileId: Nullable<string>
  title: string
}

function nextId(kind: OfficeKind): DesktopAppId {
  const prefix = kind === 'writer' ? 'wri' : 'sht'
  return `${prefix}_${createWindowIdSuffix()}`
}

function collectSessions(): OfficeSessionPersist[] {
  return listDesktopWindows()
    .filter((w): w is OfficeAppWindow => isOfficeAppWindow(w))
    .map((w) => ({
      id: w.id,
      kind: w.officeKind,
      fileId: w.fileId,
      title: (w.title ?? '').replace(/^\*\s+/, '').trim() || w.title || '',
    }))
}

function persistSessions() {
  appStorage.setJson(STORAGE_KEYS.officeSessions, { sessions: collectSessions() })
}

function readSessions(): OfficeSessionPersist[] {
  const parsed = appStorage.getJson(STORAGE_KEYS.officeSessions)
  if (!parsed || !Array.isArray(parsed.sessions)) return []
  return parsed.sessions.filter(
    (s): s is OfficeSessionPersist =>
      !!s &&
      typeof s.id === 'string' &&
      (s.id.startsWith('wri_') || s.id.startsWith('sht_')) &&
      (s.kind === 'writer' || s.kind === 'sheet') &&
      (s.fileId == null || typeof s.fileId === 'string') &&
      typeof s.title === 'string',
  )
}

export function restorePersistedOfficeSessions(): void {
  for (const session of readSessions()) {
    if (getDesktopWindow(session.id)) continue
    const win = new OfficeAppWindow({
      id: session.id,
      kind: session.kind,
      fileId: session.fileId,
      title: session.title,
    })
    registerDesktopWindow(win, { placeOnDesktop: false, syncStores: false })
  }
}

export class OfficeAppWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon
  readonly defaultCoordinate: DesktopCoordinate
  override readonly width: number
  override readonly height: number
  override readonly showInStartMenu = false
  override readonly showOnDesktop = false
  override title: string
  readonly officeKind: OfficeKind
  readonly windowKind = 'office' as const
  fileId: Nullable<string>
  dirty = false
  private deferred: Nullable<DeferredApp> = null
  private cleaned = false

  constructor(opts: { id: DesktopAppId; kind: OfficeKind; fileId?: Nullable<string>; title?: string }) {
    super()
    this.id = opts.id
    this.officeKind = opts.kind
    this.fileId = opts.fileId ?? null
    this.icon = opts.kind === 'writer' ? ScrollText : Table2
    this.defaultCoordinate = opts.kind === 'writer' ? [5, 1] : [5, 2]
    this.width = opts.kind === 'writer' ? 720 : 780
    this.height = 520
    this.title = opts.title?.trim() || (opts.kind === 'writer' ? 'WPS Writer' : 'WPS Sheet')
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const windowId = this.id
      const kind = this.officeKind
      const initialFileId = this.fileId
      this.deferred = createDeferredApp(async () => {
        const { bindOfficeApp } = await import('@/features/office/mount')
        return bindOfficeApp(kind, windowId, initialFileId)
      })
    }
    return this.deferred
  }

  get app(): AppHost {
    return this.ensureDeferred().component
  }

  override prefetchApp(): void {
    this.ensureDeferred().prefetch()
  }

  override onBeforeOpen(): boolean {
    this.prefetchApp()
    return true
  }

  override onAfterClose(): void {
    if (this.cleaned) return
    this.cleaned = true
    unregisterDesktopWindow(this.id, { close: false })
    persistSessions()
  }

  setFileMeta(fileId: Nullable<string>, title: string, dirty: boolean) {
    this.fileId = fileId
    this.dirty = dirty
    const base = title.trim() || this.title
    this.title = dirty ? `* ${base.replace(/^\*\s+/, '')}` : base.replace(/^\*\s+/, '')
    refreshDesktopWindow(this.id)
    persistSessions()
  }
}

function isOfficeAppWindow(w: DesktopWindow): w is OfficeAppWindow {
  return (w as OfficeAppWindow).windowKind === 'office'
}

export function getOfficeWindow(id: DesktopAppId): OfficeAppWindow | undefined {
  const win = getDesktopWindow(id)
  return win && isOfficeAppWindow(win) ? win : undefined
}

export function findOfficeWindowByFile(kind: OfficeKind, fileId: string): OfficeAppWindow | undefined {
  return listDesktopWindows().find(
    (w): w is OfficeAppWindow => isOfficeAppWindow(w) && w.officeKind === kind && w.fileId === fileId,
  )
}

export function spawnOfficeWindow(opts: {
  kind: OfficeKind
  id?: DesktopAppId
  fileId?: Nullable<string>
  title?: string
}): Nullable<OfficeAppWindow> {
  if (opts.fileId) {
    const existing = findOfficeWindowByFile(opts.kind, opts.fileId)
    if (existing) return existing
  }
  const prefix = opts.kind === 'writer' ? 'wri_' : 'sht_'
  const id = opts.id && opts.id.startsWith(prefix) ? opts.id : nextId(opts.kind)
  const already = getOfficeWindow(id)
  if (already) return already
  const win = new OfficeAppWindow({
    id,
    kind: opts.kind,
    fileId: opts.fileId ?? null,
    title: opts.title,
  })
  const ok = registerDesktopWindow(win, { placeOnDesktop: false })
  if (!ok) return getOfficeWindow(id) ?? null
  persistSessions()
  return win
}

export function ensureOfficeWindow(id: DesktopAppId): Nullable<OfficeAppWindow> {
  if (!id.startsWith('wri_') && !id.startsWith('sht_')) return null
  const existing = getOfficeWindow(id)
  if (existing) return existing
  const session = readSessions().find((s) => s.id === id)
  const kind: OfficeKind = id.startsWith('sht_') ? 'sheet' : 'writer'
  return spawnOfficeWindow({
    id,
    kind: session?.kind ?? kind,
    fileId: session?.fileId,
    title: session?.title,
  })
}

/** 资源管理器 / 桌面双击：已打开则聚焦，否则新开实例 */
export function openOfficeFile(kind: OfficeKind, fileId: string, title?: string): void {
  const existing = findOfficeWindowByFile(kind, fileId)
  if (existing) {
    existing.open()
    return
  }
  spawnOfficeWindow({ kind, fileId, title })?.open()
}
