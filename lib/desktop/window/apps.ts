import {
  UserPlus,
  Castle,
  Gift,
  ChartColumnBig,
  Store,
  Gamepad,
  Gamepad2,
  Building2,
  Wrench,
  BookOpenText,
  Rose,
  Mail,
  Notebook,
  FileText,
  Palette,
  Settings,
  Music,
  Calculator,
  Folder,
} from 'lucide-react'
import { Minesweeper } from '@/features/minesweeper'
import { Tetris } from '@/features/tetris'
import { Music as MusicApp } from '@/features/music'
import { SettingsApp } from '@/features/settings'
import { DocumentApp } from '@/features/document'
import { LogApp } from '@/features/log'
import { NotepadApp } from '@/features/notepad'
import { PaintApp } from '@/features/paint'
import { CalculatorApp } from '@/features/calculator'
import {
  ReferralApp,
  BridgeApp,
  ClaimApp,
  StakeApp,
  MarketApp,
  GovernanceApp,
  FoundryApp,
  DonationApp,
  EmailApp,
} from '@/features/demo'
import {
  DEFAULT_WINDOW_CHROME,
  type DesktopAppId,
  type DesktopCoordinate,
  type DesktopItemKind,
  type WindowChromeOptions,
} from '@/config/desktop'
import { DesktopWindow } from './DesktopWindow'
import { createElement, type ComponentType } from 'react'

// —— Demo / 业务演示 ——

export class ReferralWindow extends DesktopWindow {
  readonly id = 'referral' as const
  readonly icon = UserPlus
  readonly defaultCoordinate: DesktopCoordinate = [1, 1]
  readonly width = 440
  readonly height = 360
  readonly app = ReferralApp
}

export class BridgeWindow extends DesktopWindow {
  readonly id = 'bridge' as const
  readonly icon = Castle
  readonly defaultCoordinate: DesktopCoordinate = [1, 2]
  readonly width = 440
  readonly height = 360
  readonly app = BridgeApp
}

export class ClaimWindow extends DesktopWindow {
  readonly id = 'claim' as const
  readonly icon = Gift
  readonly defaultCoordinate: DesktopCoordinate = [1, 3]
  readonly width = 440
  readonly height = 360
  readonly app = ClaimApp
}

export class StakeWindow extends DesktopWindow {
  readonly id = 'stake' as const
  readonly icon = ChartColumnBig
  readonly defaultCoordinate: DesktopCoordinate = [1, 4]
  readonly width = 440
  readonly height = 360
  readonly app = StakeApp
}

export class MarketWindow extends DesktopWindow {
  readonly id = 'market' as const
  readonly icon = Store
  readonly defaultCoordinate: DesktopCoordinate = [1, 5]
  readonly width = 520
  readonly height = 400
  readonly app = MarketApp
}

export class GovernanceWindow extends DesktopWindow {
  readonly id = 'governance' as const
  readonly icon = Building2
  readonly defaultCoordinate: DesktopCoordinate = [2, 1]
  readonly width = 440
  readonly height = 360
  readonly app = GovernanceApp
}

export class FoundryWindow extends DesktopWindow {
  readonly id = 'foundry' as const
  readonly icon = Wrench
  readonly defaultCoordinate: DesktopCoordinate = [2, 2]
  readonly width = 440
  readonly height = 360
  readonly app = FoundryApp
}

export class DonationWindow extends DesktopWindow {
  readonly id = 'donation' as const
  readonly icon = Rose
  readonly defaultCoordinate: DesktopCoordinate = [2, 4]
  readonly width = 440
  readonly height = 360
  readonly app = DonationApp
}

export class EmailWindow extends DesktopWindow {
  readonly id = 'email' as const
  readonly icon = Mail
  readonly defaultCoordinate: DesktopCoordinate = [2, 5]
  readonly width = 520
  readonly height = 420
  readonly app = EmailApp
}

// —— 游戏 ——

export class MinesweeperWindow extends DesktopWindow {
  readonly id = 'minesweeper' as const
  readonly icon = Gamepad
  readonly defaultCoordinate: DesktopCoordinate = [1, 6]
  readonly width = 420
  readonly height = 560
  readonly app = Minesweeper
}

export class TetrisWindow extends DesktopWindow {
  readonly id = 'tetris' as const
  readonly icon = Gamepad2
  readonly defaultCoordinate: DesktopCoordinate = [1, 7]
  readonly width = 560
  readonly height = 640
  readonly app = Tetris
}

// —— 工具 / 文档 ——

export class DocumentWindow extends DesktopWindow {
  readonly id = 'document' as const
  readonly icon = BookOpenText
  readonly defaultCoordinate: DesktopCoordinate = [2, 3]
  readonly width = 520
  readonly height = 420
  readonly app = DocumentApp
}

export class LogWindow extends DesktopWindow {
  readonly id = 'log' as const
  readonly icon = Notebook
  readonly defaultCoordinate: DesktopCoordinate = [2, 6]
  readonly width = 520
  readonly height = 420
  readonly app = LogApp
}

export class NotepadWindow extends DesktopWindow {
  readonly id = 'notepad' as const
  readonly icon = FileText
  readonly defaultCoordinate: DesktopCoordinate = [3, 1]
  readonly width = 560
  readonly height = 460
  readonly app = NotepadApp
}

export class PaintWindow extends DesktopWindow {
  readonly id = 'paint' as const
  readonly icon = Palette
  readonly defaultCoordinate: DesktopCoordinate = [3, 2]
  readonly width = 720
  readonly height = 560
  readonly app = PaintApp
}

export class SettingsWindow extends DesktopWindow {
  readonly id = 'settings' as const
  readonly icon = Settings
  readonly defaultCoordinate: DesktopCoordinate = [2, 7]
  readonly width = 560
  readonly height = 520
  readonly app = SettingsApp
}

export class MusicWindow extends DesktopWindow {
  readonly id = 'music' as const
  readonly icon = Music
  readonly defaultCoordinate: DesktopCoordinate = [2, 8]
  readonly width = 420
  readonly height = 620
  readonly app = MusicApp
}

/**
 * 计算器：固定尺寸（禁止缩放），其余行为继承基类。
 * 可在此继续扩展应用专属能力（例如 reset / 快捷键等）。
 */
export class CalculatorWindow extends DesktopWindow {
  readonly id = 'calculator' as const
  readonly icon = Calculator
  readonly defaultCoordinate: DesktopCoordinate = [3, 3]
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
