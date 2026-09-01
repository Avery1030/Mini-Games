import { CodeXml, Globe } from 'lucide-react'
import type { ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate } from '@/config/desktop'
import { STORAGE_KEYS, appStorage, type IdeSessionPersist } from '@/lib/storage'
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

function nextId(prefix: 'ide' | 'preview'): DesktopAppId {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : `${Date.now().toString(36)}`
  return `${prefix}_${rand}`
}

function untitledTitle(): string {
  return 'Untitled'
}

function sessionTitle(win: IdeEditorWindow): string {
  if (win.filePath) {
    return win.filePath.slice(win.filePath.lastIndexOf('/') + 1) || win.filePath
  }
  return win.title.replace(/^\*\s+/, '').trim() || untitledTitle()
}

function collectIdeSessions(): IdeSessionPersist[] {
  return listDesktopWindows()
    .filter((w): w is IdeEditorWindow => isIdeEditorWindow(w))
    .map((w) => ({
      id: w.id,
      filePath: w.filePath,
      title: sessionTitle(w),
    }))
}

function persistIdeSessions() {
  appStorage.setJson(STORAGE_KEYS.ideSessions, { sessions: collectIdeSessions() })
}

function readIdeSessions(): IdeSessionPersist[] {
  const parsed = appStorage.getJson(STORAGE_KEYS.ideSessions)
  if (!parsed || !Array.isArray(parsed.sessions)) return []
  return parsed.sessions.filter(
    (s): s is IdeSessionPersist =>
      !!s &&
      typeof s.id === 'string' &&
      s.id.startsWith('ide_') &&
      (s.filePath == null || typeof s.filePath === 'string') &&
      typeof s.title === 'string',
  )
}

/** 水合前把上次打开的 IDE 窗口重新注册进 registry */
export function restorePersistedIdeSessions(): void {
  for (const session of readIdeSessions()) {
    if (getDesktopWindow(session.id)) continue
    const win = new IdeEditorWindow({
      id: session.id,
      filePath: session.filePath,
      title: session.title,
    })
    registerDesktopWindow(win, { placeOnDesktop: false, syncStores: false })
  }
}

/**
 * 简易 IDE 编辑器窗口：运行时多开，每个实例独立文件与脏标记。
 */
export class IdeEditorWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = CodeXml
  readonly defaultCoordinate: DesktopCoordinate = [4, 1]
  override readonly width = 720
  override readonly height = 520
  override readonly showInStartMenu = false
  override readonly showOnDesktop = false
  override title: string
  filePath: Nullable<string>
  dirty = false
  readonly windowKind = 'ide-editor' as const
  unsavedTitle = 'Confirm'
  unsavedMessage = 'This file has unsaved changes. Close anyway?'
  closeSaveLabel = 'Save'
  closeDiscardLabel = "Don't Save"
  closeCancelLabel = 'Cancel'
  saveHandler: Nullable<(() => Promise<boolean>)> = null
  previewId: Nullable<DesktopAppId> = null
  onRetargetPath: Nullable<((path: string) => void)> = null
  private deferred: Nullable<DeferredApp> = null
  private closeConfirming = false
  private cleaned = false

  constructor(opts: { id: DesktopAppId; filePath?: Nullable<string>; title?: string }) {
    super()
    this.id = opts.id
    this.filePath = opts.filePath ?? null
    this.title = opts.title?.trim() || untitledTitle()
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const windowId = this.id
      const initialPath = this.filePath
      this.deferred = createDeferredApp(async () => {
        const { bindIdeApp } = await import('@/features/ide/mount')
        return bindIdeApp(windowId, initialPath)
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

  override onBeforeClose(): boolean {
    if (!this.dirty || this.closeConfirming) return !this.dirty
    this.closeConfirming = true
    void this.confirmClose()
    return false
  }

  override onAfterClose(): void {
    if (this.cleaned) return
    this.cleaned = true
    unregisterDesktopWindow(this.id, { close: false })
    persistIdeSessions()
  }

  setFileMeta(path: Nullable<string>, dirty: boolean, untitled = untitledTitle()) {
    const prevPath = this.filePath
    this.filePath = path
    this.dirty = dirty
    const base = path ? path.slice(path.lastIndexOf('/') + 1) || path : untitled
    this.title = dirty ? `* ${base}` : base
    refreshDesktopWindow(this.id)
    if (prevPath !== path) {
      persistIdeSessions()
      if (path) this.onRetargetPath?.(path)
    }
  }

  private async confirmClose() {
    try {
      const { modal } = await import('@/components/ui')
      const choice = await new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
        modal.open({
          title: this.unsavedTitle,
          content: this.unsavedMessage,
          dismissible: false,
          showClose: true,
          widthClassName: 'w-[min(380px,calc(100vw-2rem))]',
          actions: [
            { id: 'save', label: this.closeSaveLabel, primary: true },
            { id: 'discard', label: this.closeDiscardLabel },
            { id: 'cancel', label: this.closeCancelLabel },
          ],
          onClose: ({ reason, actionId }) => {
            if (reason === 'action' && actionId === 'save') resolve('save')
            else if (reason === 'action' && actionId === 'discard') resolve('discard')
            else resolve('cancel')
          },
        })
      })
      if (choice === 'cancel') return
      if (choice === 'save') {
        const ok = await this.saveHandler?.()
        if (!ok) return
      }
      this.dirty = false
      const { useWindowStore } = await import('@/store/window')
      useWindowStore.getState().forceCloseWindow(this.id)
    } finally {
      this.closeConfirming = false
    }
  }
}

/**
 * HTML 运行预览窗口：iframe sandbox 加载当前编辑器 HTML。
 */
export class HtmlPreviewWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = Globe
  readonly defaultCoordinate: DesktopCoordinate = [5, 1]
  override readonly width = 640
  override readonly height = 480
  override readonly showInStartMenu = false
  override readonly showOnDesktop = false
  readonly windowKind = 'html-preview' as const
  override title: string
  html: string
  revision = 0
  private deferred: Nullable<DeferredApp> = null
  private cleaned = false

  constructor(opts: { id: DesktopAppId; title: string; html: string }) {
    super()
    this.id = opts.id
    this.title = opts.title
    this.html = opts.html
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const windowId = this.id
      this.deferred = createDeferredApp(async () => {
        const { bindHtmlPreviewApp } = await import('@/features/ide/mount')
        return bindHtmlPreviewApp(windowId)
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
  }

  updateHtml(html: string, title?: string) {
    this.html = html
    this.revision += 1
    if (title?.trim()) this.title = title.trim()
    refreshDesktopWindow(this.id)
  }

  setTitle(title: string) {
    const next = title.trim()
    if (!next || next === this.title) return
    this.title = next
    refreshDesktopWindow(this.id)
  }
}

export function spawnIdeEditor(opts?: {
  id?: DesktopAppId
  filePath?: Nullable<string>
  title?: string
}): Nullable<IdeEditorWindow> {
  const id = opts?.id && opts.id.startsWith('ide_') ? opts.id : nextId('ide')
  const existing = getIdeEditorWindow(id)
  if (existing) return existing
  const win = new IdeEditorWindow({
    id,
    filePath: opts?.filePath ?? null,
    title: opts?.title,
  })
  const ok = registerDesktopWindow(win, { placeOnDesktop: false })
  if (!ok) return getIdeEditorWindow(id) ?? null
  persistIdeSessions()
  return win
}

/** 深链 / 刷新：按已有 id 恢复窗口，没有会话时至少开一个空编辑器 */
export function ensureIdeEditorWindow(id: DesktopAppId): Nullable<IdeEditorWindow> {
  if (!id.startsWith('ide_')) return null
  const existing = getIdeEditorWindow(id)
  if (existing) return existing
  const session = readIdeSessions().find((s) => s.id === id)
  return spawnIdeEditor({
    id,
    filePath: session?.filePath,
    title: session?.title,
  })
}

function isIdeEditorWindow(w: DesktopWindow): w is IdeEditorWindow {
  return (w as IdeEditorWindow).windowKind === 'ide-editor'
}

function isHtmlPreviewWindow(w: DesktopWindow): w is HtmlPreviewWindow {
  return (w as HtmlPreviewWindow).windowKind === 'html-preview'
}

export function findIdeWindowByPath(filePath: string): IdeEditorWindow | undefined {
  return listDesktopWindows().find((w): w is IdeEditorWindow => isIdeEditorWindow(w) && w.filePath === filePath)
}

export function getIdeEditorWindow(id: DesktopAppId): IdeEditorWindow | undefined {
  const win = getDesktopWindow(id)
  return win && isIdeEditorWindow(win) ? win : undefined
}

export function getHtmlPreviewWindow(id: DesktopAppId): HtmlPreviewWindow | undefined {
  const win = getDesktopWindow(id)
  return win && isHtmlPreviewWindow(win) ? win : undefined
}

export function findExistingHtmlPreview(): HtmlPreviewWindow | undefined {
  return listDesktopWindows().find((w): w is HtmlPreviewWindow => isHtmlPreviewWindow(w))
}

/** 资源管理器 / 桌面双击代码文件：已打开则聚焦，否则新开实例 */
export function openIdeFile(filePath: string): void {
  const existing = findIdeWindowByPath(filePath)
  if (existing) {
    existing.open()
    return
  }
  const name = filePath.slice(filePath.lastIndexOf('/') + 1) || filePath
  spawnIdeEditor({ filePath, title: name })?.open()
}

export function spawnHtmlPreview(opts: { html: string; title: string; reuseId?: Nullable<string> }): Nullable<HtmlPreviewWindow> {
  const existing =
    (opts.reuseId ? getHtmlPreviewWindow(opts.reuseId) : undefined) ?? findExistingHtmlPreview()
  if (existing) {
    existing.updateHtml(opts.html, opts.title)
    existing.open()
    return existing
  }
  const win = new HtmlPreviewWindow({
    id: nextId('preview'),
    title: opts.title,
    html: opts.html,
  })
  const ok = registerDesktopWindow(win, { placeOnDesktop: false })
  if (!ok) return null
  return win
}
