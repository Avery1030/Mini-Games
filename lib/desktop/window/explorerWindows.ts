import { HardDrive } from 'lucide-react'
import type { ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
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

type AppHost = ComponentType

export type ExplorerSessionPersist = {
  id: string
  path: string
  title: string
}

function nextId(): DesktopAppId {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : `${Date.now().toString(36)}`
  return `exp_${rand}`
}

function isExplorerWindow(w: DesktopWindow): w is ExplorerAppWindow {
  return (w as ExplorerAppWindow).windowKind === 'explorer'
}

function collectSessions(): ExplorerSessionPersist[] {
  return listDesktopWindows()
    .filter((w): w is ExplorerAppWindow => isExplorerWindow(w))
    .map((w) => ({
      id: w.id,
      path: w.path,
      title: w.title,
    }))
}

function persistSessions() {
  appStorage.setJson(STORAGE_KEYS.explorerSessions, { sessions: collectSessions() })
}

function readSessions(): ExplorerSessionPersist[] {
  const parsed = appStorage.getJson(STORAGE_KEYS.explorerSessions)
  if (!parsed || !Array.isArray(parsed.sessions)) return []
  return parsed.sessions.filter(
    (s): s is ExplorerSessionPersist =>
      !!s &&
      typeof s.id === 'string' &&
      s.id.startsWith('exp_') &&
      typeof s.path === 'string' &&
      typeof s.title === 'string',
  )
}

export function restorePersistedExplorerSessions(): void {
  for (const session of readSessions()) {
    if (getDesktopWindow(session.id)) continue
    const win = new ExplorerAppWindow({
      id: session.id,
      path: session.path,
      title: session.title,
    })
    registerDesktopWindow(win, { placeOnDesktop: false, syncStores: false })
  }
}

export class ExplorerAppWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = HardDrive
  readonly defaultCoordinate: DesktopCoordinate = [2, 5]
  override readonly width = 720
  override readonly height = 480
  override readonly showInStartMenu = false
  override readonly showOnDesktop = false
  override title: string
  readonly windowKind = 'explorer' as const
  path: string
  private deferred: Nullable<DeferredApp> = null
  private cleaned = false

  constructor(opts: { id: DesktopAppId; path?: string; title?: string }) {
    super()
    this.id = opts.id
    this.path = opts.path?.trim() || '/'
    this.title = opts.title?.trim() || 'Explorer'
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const windowId = this.id
      const initialPath = this.path
      this.deferred = createDeferredApp(async () => {
        const { bindExplorerApp } = await import('@/features/file-explorer/mount')
        return bindExplorerApp(windowId, initialPath)
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

  setPath(path: string, title?: string) {
    this.path = path
    if (title) this.title = title
    refreshDesktopWindow(this.id)
    persistSessions()
  }
}

export function getExplorerWindow(id: DesktopAppId): ExplorerAppWindow | undefined {
  const win = getDesktopWindow(id)
  return win && isExplorerWindow(win) ? win : undefined
}

export function spawnExplorerWindow(opts?: {
  id?: DesktopAppId
  path?: string
  title?: string
}): Nullable<ExplorerAppWindow> {
  const id = opts?.id && opts.id.startsWith('exp_') ? opts.id : nextId()
  const already = getExplorerWindow(id)
  if (already) {
    if (opts?.path) already.setPath(opts.path, opts.title)
    return already
  }
  const win = new ExplorerAppWindow({
    id,
    path: opts?.path,
    title: opts?.title,
  })
  const ok = registerDesktopWindow(win, { placeOnDesktop: false })
  if (!ok) return getExplorerWindow(id) ?? null
  persistSessions()
  return win
}

export function ensureExplorerWindow(id: DesktopAppId): Nullable<ExplorerAppWindow> {
  if (!id.startsWith('exp_')) return null
  const existing = getExplorerWindow(id)
  if (existing) return existing
  const session = readSessions().find((s) => s.id === id)
  return spawnExplorerWindow({
    id,
    path: session?.path,
    title: session?.title,
  })
}
