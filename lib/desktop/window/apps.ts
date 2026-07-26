import {
  Gamepad,
  Gamepad2,
  BookOpenText,
  Notebook,
  FileText,
  Palette,
  Settings,
  Calculator,
  Folder,
  Trash2,
  Terminal,
  ChartCandlestick,
  Bot,
  AppWindow,
  ImageIcon,
} from 'lucide-react'
import { Minesweeper } from '@/features/minesweeper'
import { Tetris } from '@/features/tetris'
import { SettingsApp } from '@/features/settings'
import { DocumentApp } from '@/features/document'
import { LogApp } from '@/features/log'
import { NotepadApp } from '@/features/notepad'
import { PaintApp } from '@/features/paint'
import { CalculatorApp } from '@/features/calculator'
import { AiChatApp } from '@/features/ai-chat'
import { ImageViewerApp } from '@/features/image-viewer'
import {
  DEFAULT_WINDOW_CHROME,
  type DesktopAppId,
  type DesktopCoordinate,
  type DesktopItemKind,
  type WindowChromeOptions,
} from '@/config/desktop'
import { DesktopWindow } from './DesktopWindow'
import { createElement, type ComponentType } from 'react'

// —— 游戏 ——

export class MinesweeperWindow extends DesktopWindow {
  readonly id = 'minesweeper' as const
  readonly icon = Gamepad
  readonly defaultCoordinate: DesktopCoordinate = [1, 1]
  readonly width = 420
  readonly height = 560
  readonly app = Minesweeper
}

export class TetrisWindow extends DesktopWindow {
  readonly id = 'tetris' as const
  readonly icon = Gamepad2
  readonly defaultCoordinate: DesktopCoordinate = [1, 2]
  readonly width = 560
  readonly height = 640
  readonly app = Tetris
}

// —— 工具 / 文档 ——

export class DocumentWindow extends DesktopWindow {
  readonly id = 'document' as const
  readonly icon = BookOpenText
  readonly defaultCoordinate: DesktopCoordinate = [1, 3]
  readonly width = 520
  readonly height = 420
  readonly app = DocumentApp
}

export class LogWindow extends DesktopWindow {
  readonly id = 'log' as const
  readonly icon = Notebook
  readonly defaultCoordinate: DesktopCoordinate = [1, 4]
  readonly width = 520
  readonly height = 420
  readonly app = LogApp
}

export class NotepadWindow extends DesktopWindow {
  readonly id = 'notepad' as const
  readonly icon = FileText
  readonly defaultCoordinate: DesktopCoordinate = [2, 1]
  readonly width = 560
  readonly height = 460
  readonly app = NotepadApp
}

export class PaintWindow extends DesktopWindow {
  readonly id = 'paint' as const
  readonly icon = Palette
  readonly defaultCoordinate: DesktopCoordinate = [2, 2]
  readonly width = 720
  readonly height = 560
  readonly app = PaintApp
}

export class SettingsWindow extends DesktopWindow {
  readonly id = 'settings' as const
  readonly icon = Settings
  readonly defaultCoordinate: DesktopCoordinate = [2, 3]
  readonly width = 560
  readonly height = 520
  readonly app = SettingsApp
}

/**
 * 计算器：固定尺寸（禁止缩放），其余行为继承基类。
 */
export class CalculatorWindow extends DesktopWindow {
  readonly id = 'calculator' as const
  readonly icon = Calculator
  readonly defaultCoordinate: DesktopCoordinate = [2, 4]
  readonly width = 320
  readonly height = 440
  readonly app = CalculatorApp

  override get chrome(): WindowChromeOptions {
    return {
      ...DEFAULT_WINDOW_CHROME,
      resizable: false,
    }
  }
}

/**
 * 命令提示符：简易 DOS 风格终端。
 * CmdApp 延迟加载，避免循环依赖。
 */
export class CmdWindow extends DesktopWindow {
  readonly id = 'cmd' as const
  readonly icon = Terminal
  readonly defaultCoordinate: DesktopCoordinate = [3, 1]
  readonly width = 640
  readonly height = 400
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { CmdApp } = require('@/features/cmd') as typeof import('@/features/cmd')
        return createElement(CmdApp, { embedded: props.embedded })
      }
    }
    return this.appComponent
  }
}

/**
 * 回收站：内置桌面应用，列出软删除的桌面资源。
 * RecycleBinApp 延迟加载，避免 apps → feature → store → registry 循环依赖。
 */
export class RecycleBinWindow extends DesktopWindow {
  readonly id = 'recycleBin' as const
  readonly icon = Trash2
  readonly defaultCoordinate: DesktopCoordinate = [1, 5]
  readonly width = 520
  readonly height = 400
  readonly showInStartMenu = false
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { RecycleBinApp } = require('@/features/recycle-bin') as typeof import('@/features/recycle-bin')
        return createElement(RecycleBinApp, { embedded: props.embedded })
      }
    }
    return this.appComponent
  }
}

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
        // 运行时再取，打断模块初始化环
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
 * FolderApp 延迟加载，避免 apps → folder → store → registry 循环依赖。
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
        // 运行时再取，打断模块初始化环
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

/**
 * K 线图表：延迟加载 feature，避免 klinecharts 在 SSR 顶层访问 window。
 */
export class KlineChartViewerWindow extends DesktopWindow {
  readonly id = 'klineChartViewer' as const
  readonly icon = ChartCandlestick
  readonly defaultCoordinate: DesktopCoordinate = [3, 2]
  readonly width = 1024
  readonly height = 768
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { KlineChartViewer } = require('@/features/KlineChartViewer') as typeof import('@/features/KlineChartViewer')
        return createElement(KlineChartViewer, { embedded: props.embedded })
      }
    }
    return this.appComponent
  }
}

/**
 * 智聊：SiliconFlow 文字对话（流式）。
 */
export class AiChatWindow extends DesktopWindow {
  readonly id = 'aiChat' as const
  readonly icon = Bot
  readonly defaultCoordinate: DesktopCoordinate = [3, 3]
  readonly width = 560
  readonly height = 520
  readonly app = AiChatApp
}

/**
 * 图片查看器：本地上传 / URL 导入，落盘 .data/images，支持多选浏览。
 */
export class ImageViewerWindow extends DesktopWindow {
  readonly id = 'imageViewer' as const
  readonly icon = ImageIcon
  readonly defaultCoordinate: DesktopCoordinate = [3, 5]
  readonly width = 760
  readonly height = 560
  readonly app = ImageViewerApp
}

/**
 * 任务管理器：运行窗口 / 程序列表，结束任务与最小化全部。
 * 延迟加载，避免 apps → feature → hooks → registry 循环依赖。
 */
export class TaskManagerWindow extends DesktopWindow {
  readonly id = 'taskManager' as const
  readonly icon = AppWindow
  readonly defaultCoordinate: DesktopCoordinate = [3, 4]
  readonly width = 420
  readonly height = 480
  private appComponent: ComponentType<{ embedded?: boolean }> | null = null

  get app(): ComponentType<{ embedded?: boolean }> {
    if (!this.appComponent) {
      this.appComponent = (props: { embedded?: boolean }) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { TaskManagerApp } = require('@/features/task-manager') as typeof import('@/features/task-manager')
        return createElement(TaskManagerApp, { embedded: props.embedded })
      }
    }
    return this.appComponent
  }
}
