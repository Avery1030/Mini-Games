import { Folder, FileText } from 'lucide-react'
import { createElement, type ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate, DesktopItemKind } from '@/config/desktop'
import { DesktopWindow } from './DesktopWindow'
import { createDeferredApp, type DeferredApp } from './defineApp'

type AppHost = ComponentType

/**
 * 桌面文本文档窗口：运行时由 createDesktopTextDocumentWindow 实例化。
 * TextDocumentApp 延迟加载，避免循环依赖。
 */
export class TextDocumentWindow extends DesktopWindow {
  readonly id: DesktopAppId
  readonly icon = FileText
  readonly defaultCoordinate: DesktopCoordinate
  override readonly width = 560
  override readonly height = 460
  override readonly kind: DesktopItemKind = 'textDocument'
  override readonly showInStartMenu = false
  readonly noteId: string
  override title: string
  private deferred: Nullable<DeferredApp> = null

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
        return function TextDocumentLoaded() {
          return createElement(TextDocumentApp, {
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
  override readonly width = 480
  override readonly height = 360
  override readonly kind: DesktopItemKind = 'folder'
  override readonly showInStartMenu = false
  override title: string
  private deferred: Nullable<DeferredApp> = null

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
        return function FolderLoaded() {
          return createElement(FolderApp, {
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
