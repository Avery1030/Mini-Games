import type { ComponentType } from 'react'
import {
  DEFAULT_WINDOW_CHROME,
  type AppTitles,
  type DesktopAppDefinition,
  type DesktopAppId,
  type DesktopCoordinate,
  type DesktopItemKind,
  type DesktopWindowRuntime,
  type WindowBounds,
  type WindowChromeOptions,
} from '@/config/desktop'

export type DesktopIconComponent = ComponentType<{
  className?: string
  size?: number
  strokeWidth?: number
  absoluteStrokeWidth?: boolean
}>

export { DEFAULT_WINDOW_CHROME }

/**
 * 桌面窗口控制器：由 window store 注册，避免 DesktopWindow ↔ store 循环依赖。
 */
export type WindowController = {
  openWindow: (id: DesktopAppId) => void
  closeWindow: (id: DesktopAppId) => void
  minimizeWindow: (id: DesktopAppId) => void
  focusWindow: (id: DesktopAppId) => void
  getRuntime: (id: DesktopAppId) => DesktopWindowRuntime | undefined
  ensureWindow: (id: DesktopAppId) => void
  removeWindow: (id: DesktopAppId) => void
}

let controller: WindowController | null = null

export function registerWindowController(next: WindowController) {
  controller = next
}

function getController(): WindowController {
  if (!controller) {
    throw new Error('WindowController 尚未注册：请确保 useWindowStore 已初始化')
  }
  return controller
}

export function ensureWindowSlot(id: DesktopAppId): void {
  getController().ensureWindow(id)
}

export function removeWindowSlot(id: DesktopAppId): void {
  getController().removeWindow(id)
}

/**
 * 桌面窗口基类。
 * 每个可打开应用对应一个子类实例：继承开/关/最小化/聚焦等通用能力，并可覆盖 chrome 与生命周期。
 * React 内容仍通过 `app` 组件渲染；可序列化状态仍在 window store。
 */
export abstract class DesktopWindow {
  abstract readonly id: DesktopAppId
  abstract readonly icon: DesktopIconComponent
  abstract readonly defaultCoordinate: DesktopCoordinate

  /** 有 app 才能打开窗口；仅桌面图标时可省略 */
  abstract readonly app?: ComponentType<{ embedded?: boolean }>

  readonly width: number = 400
  readonly height: number = 320

  /** 运行时显示名；动态项（文件夹）必填，内置项可省略走 titles / i18n */
  title?: string

  /** 多语言标题（registerBuiltinApp）；优先于 messages.apps.* */
  readonly titles?: AppTitles

  readonly kind: DesktopItemKind = 'app'

  /** 是否出现在开始菜单 */
  readonly showInStartMenu: boolean = true

  /** 是否出现在桌面图标层 */
  readonly showOnDesktop: boolean = true

  /** 子类覆盖以定制拖拽 / 缩放 / 最小化 / 最大化 */
  get chrome(): WindowChromeOptions {
    return DEFAULT_WINDOW_CHROME
  }

  /** 预取懒加载 chunk（打开前调用，避免窗口先白屏） */
  prefetchApp(): void {}

  // —— 生命周期（store 在状态变更前后调用；返回 false 可取消）——

  onBeforeOpen(): boolean {
    return true
  }

  onAfterOpen(): void {
    // console.log('onAfterOpen', this.id)
  }

  onBeforeClose(): boolean {
    return true
  }

  onAfterClose(): void {}

  onBeforeMinimize(): boolean {
    return true
  }

  onAfterMinimize(): void {}

  // —— 实例 API（委托 store）——

  open(): void {
    getController().openWindow(this.id)
  }

  close(): void {
    getController().closeWindow(this.id)
  }

  minimize(): void {
    getController().minimizeWindow(this.id)
  }

  focus(): void {
    getController().focusWindow(this.id)
  }

  getRuntime(): DesktopWindowRuntime | undefined {
    return getController().getRuntime(this.id)
  }

  getBounds(): WindowBounds | null {
    return this.getRuntime()?.bounds ?? null
  }

  get isOpen(): boolean {
    return this.getRuntime()?.isOpen ?? false
  }

  get isMinimized(): boolean {
    return this.getRuntime()?.minimized ?? false
  }

  get isActive(): boolean {
    return this.getRuntime()?.active ?? false
  }

  /** 转为静态定义，供图标层 / 任务栏等使用 */
  toDefinition(): DesktopAppDefinition {
    return {
      id: this.id,
      icon: this.icon,
      defaultCoordinate: this.defaultCoordinate,
      app: this.app,
      width: this.width,
      height: this.height,
      chrome: this.chrome,
      title: this.title,
      titles: this.titles,
      kind: this.kind,
      showInStartMenu: this.showInStartMenu,
      showOnDesktop: this.showOnDesktop,
    }
  }
}
