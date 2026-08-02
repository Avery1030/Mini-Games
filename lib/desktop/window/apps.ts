import { Folder, FileText } from 'lucide-react'
import { createElement, type ComponentType } from 'react'
import type { DesktopAppId, DesktopCoordinate, DesktopItemKind } from '@/config/desktop'
import { DesktopWindow } from './DesktopWindow'

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
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  constructor(opts: { id: DesktopAppId; title: string; noteId: string; coordinate?: DesktopCoordinate }) {
    super()
    this.id = opts.id
    this.title = opts.title
    this.noteId = opts.noteId
    this.defaultCoordinate = opts.coordinate ?? [1, 1]
  }

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      const itemId = this.id
      const noteId = this.noteId
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TextDocumentApp } = require('@/features/text-document') as typeof import('@/features/text-document')
        return createElement(TextDocumentApp, {
          embedded: props.embedded,
          itemId,
          noteId,
        })
      }
    }
    return this.appComponent
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
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  constructor(opts: { id: DesktopAppId; title: string; coordinate?: DesktopCoordinate }) {
    super()
    this.id = opts.id
    this.title = opts.title
    this.defaultCoordinate = opts.coordinate ?? [1, 1]
  }

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      const folderId = this.id
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { FolderApp } = require('@/features/folder') as typeof import('@/features/folder')
        return createElement(FolderApp, {
          embedded: props.embedded,
          folderId,
        })
      }
    }
    return this.appComponent
  }

  rename(nextTitle: string) {
    const trimmed = nextTitle.trim()
    if (!trimmed) return
    this.title = trimmed
  }
}
