import { Folder, FileText } from 'lucide-react'
import { createElement, type ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate, DesktopItemKind } from '@/config/desktop'
import { DesktopWindow } from './DesktopWindow'
import { createDeferredApp, type DeferredApp } from './defineApp'

type AppHost = ComponentType<{ embedded?: boolean }>

/**
 * 桌面文本文档窗口：运行时由 createDesktopTextDocumentWindow 实例化。
 * TextDocumentApp 延迟加载，避免循环依赖。
 */
export class TextDocumentWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = FileText
  readonly defaultCoordinate: DesktopCoordinate
  readonly width = 560
  readonly height = 460
  readonly kind: DesktopItemKind = 'textDocument'
  readonly showInStartMenu = false
  readonly noteId: string
  title: string
  private deferred: DeferredApp | null = null

  constructor(opts: { id: DesktopAppId; title: string; noteId: string; coordinate?: DesktopCoordinate }) {
    super()
    this.id = opts.id
    this.title = opts.title
    this.noteId = opts.noteId
    this.defaultCoordinate = opts.coordinate ?? [1, 1]
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const itemId = this.id
      const noteId = this.noteId
      this.deferred = createDeferredApp(async () => {
        const { TextDocumentApp } = await import('@/features/text-document')
        return function TextDocumentLoaded(props: { embedded?: boolean }) {
          return createElement(TextDocumentApp, {
            embedded: props.embedded,
            itemId,
            noteId,
          })
        }
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

  rename(nextTitle: string) {
    const trimmed = nextTitle.trim()
    if (!trimmed) return
    this.title = trimmed
  }
}

/**
 * 桌面文件夹窗口：运行时由 createDesktopFolder 实例化。
 * FolderApp 延迟加载，避免循环依赖。
 */
export class FolderWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = Folder
  readonly defaultCoordinate: DesktopCoordinate
  readonly width = 480
  readonly height = 360
  readonly kind: DesktopItemKind = 'folder'
  readonly showInStartMenu = false
  title: string
  private deferred: DeferredApp | null = null

  constructor(opts: { id: DesktopAppId; title: string; coordinate?: DesktopCoordinate }) {
    super()
    this.id = opts.id
    this.title = opts.title
    this.defaultCoordinate = opts.coordinate ?? [1, 1]
  }

  private ensureDeferred(): DeferredApp {
    if (!this.deferred) {
      const folderId = this.id
      this.deferred = createDeferredApp(async () => {
        const { FolderApp } = await import('@/features/folder')
        return function FolderLoaded(props: { embedded?: boolean }) {
          return createElement(FolderApp, {
            embedded: props.embedded,
            folderId,
          })
        }
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

  rename(nextTitle: string) {
    const trimmed = nextTitle.trim()
    if (!trimmed) return
    this.title = trimmed
  }
}
