import { createElement, type ComponentType } from 'react'
import {
  DEFAULT_WINDOW_CHROME,
  type AppTitles,
  type DesktopAppId,
  type DesktopCoordinate,
  type WindowChromeOptions,
} from '@/config/desktop'
import { DesktopWindow, type DesktopIconComponent } from './DesktopWindow'
import { pushBuiltinWindow } from './registry'

export type RegisterBuiltinAppOptions = {
  id: DesktopAppId
  icon: DesktopIconComponent
  /** 直接挂载的应用组件；与 loadApp 二选一 */
  app?: ComponentType<{ embedded?: boolean }>
  /** 延迟加载（打断循环依赖 / 避开 SSR 顶层副作用） */
  loadApp?: () => ComponentType<{ embedded?: boolean }>
  defaultCoordinate: DesktopCoordinate
  width?: number
  height?: number
  /** 多语言标题；优先于 messages.apps.* */
  titles?: AppTitles
  /** 固定标题（动态项常用）；优先于 titles */
  title?: string
  chrome?: Partial<WindowChromeOptions>
  showOnDesktop?: boolean
  showInStartMenu?: boolean
}

/**
 * 由声明式配置生成 DesktopWindow 实例（不自动注册）。
 */
export function defineDesktopApp(opts: RegisterBuiltinAppOptions): DesktopWindow {
  if (!opts.app && !opts.loadApp) {
    throw new Error(`[defineDesktopApp] ${opts.id}: 需要 app 或 loadApp`)
  }

  const chromeMerged: WindowChromeOptions = opts.chrome
    ? { ...DEFAULT_WINDOW_CHROME, ...opts.chrome }
    : DEFAULT_WINDOW_CHROME

  class DefinedAppWindow extends DesktopWindow {
    readonly id = opts.id
    readonly icon = opts.icon
    readonly defaultCoordinate = opts.defaultCoordinate
    readonly width = opts.width ?? 400
    readonly height = opts.height ?? 320
    readonly titles = opts.titles
    readonly title = opts.title
    readonly showOnDesktop = opts.showOnDesktop ?? true
    readonly showInStartMenu = opts.showInStartMenu ?? true
    private lazyApp: ComponentType<{ embedded?: boolean }> | null = null

    override get chrome(): WindowChromeOptions {
      return chromeMerged
    }

    get app(): ComponentType<{ embedded?: boolean }> {
      if (opts.app) return opts.app
      if (!this.lazyApp && opts.loadApp) {
        const Comp = opts.loadApp()
        this.lazyApp = function LoadedApp(props: { embedded?: boolean }) {
          return createElement(Comp, { embedded: props.embedded })
        }
      }
      return this.lazyApp!
    }
  }

  return new DefinedAppWindow()
}

/**
 * 声明式注册内置应用：写 UI + 调用本函数（再在 builtins.ts 加一行 import）即可。
 */
export function registerBuiltinApp(opts: RegisterBuiltinAppOptions): DesktopWindow {
  const win = defineDesktopApp(opts)
  if (!pushBuiltinWindow(win)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[registerBuiltinApp] duplicate id ignored: ${opts.id}`)
    }
  }
  return win
}
