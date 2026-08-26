import { createElement, lazy, Suspense, type ComponentType } from 'react'
import {
  DEFAULT_WINDOW_CHROME,
  type AppTitles,
  type DesktopAppId,
  type DesktopCoordinate,
  type WindowChromeOptions,
} from '@/config/desktop'
import { DesktopWindow, type DesktopIconComponent } from './DesktopWindow'
import { pushBuiltinWindow } from './registry'

export type AppComponent = ComponentType<{ embedded?: boolean }>

/** 打开窗口时再动态 import 应用组件 */
export type LoadAppFn = () => Promise<AppComponent>

export type RegisterBuiltinAppOptions = {
  id: DesktopAppId
  icon: DesktopIconComponent
  /** 直接挂载的应用组件；与 loadApp 二选一 */
  app?: AppComponent
  /** 延迟加载：打开窗口渲染时才 import */
  loadApp?: LoadAppFn
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
  /**
   * 打开前钩子；返回 false 可取消打开。
   * 用于多实例启动器：桌面图标打开时派生新窗口，自身不停留在任务栏。
   */
  beforeOpen?: () => boolean
}

export type DeferredApp = {
  component: AppComponent
  /** 提前开始 import（打开前 / 悬停预取） */
  prefetch: () => void
}

function AppChunkFallback() {
  return createElement(
    'div',
    {
      className: 'flex h-full min-h-[8rem] w-full items-center justify-center bg-window-body',
      role: 'status',
      'aria-busy': 'true',
    },
    createElement('div', {
      className: 'size-5 animate-spin rounded-full border-2 border-muted border-t-on-chrome',
    }),
  )
}

/** 将异步 load 包成可同步挂到 definition 上的组件（共享 promise + Suspense 占位） */
export function createDeferredApp(load: LoadAppFn): DeferredApp {
  let promise: Promise<AppComponent> | null = null
  let resolved: AppComponent | null = null

  const ensure = () => {
    if (!promise) {
      promise = load().then((Comp) => {
        resolved = Comp
        return Comp
      })
    }
    return promise
  }

  const LazyComp = lazy(() => ensure().then((Comp) => ({ default: Comp })))

  return {
    prefetch: () => {
      void ensure()
    },
    component: function DeferredApp(props: { embedded?: boolean }) {
      // 预取已完成：同步渲染，跳过 Suspense，打开即显
      if (resolved) return createElement(resolved, props)
      return createElement(
        Suspense,
        { fallback: createElement(AppChunkFallback) },
        createElement(LazyComp, props),
      )
    },
  }
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
    override readonly width = opts.width ?? 400
    override readonly height = opts.height ?? 320
    override readonly titles = opts.titles
    override readonly title = opts.title
    override readonly showOnDesktop = opts.showOnDesktop ?? true
    override readonly showInStartMenu = opts.showInStartMenu ?? true
    private deferred: DeferredApp | null = null

    override get chrome(): WindowChromeOptions {
      return chromeMerged
    }

    private ensureDeferred(): DeferredApp | null {
      if (opts.app) return null
      if (!this.deferred && opts.loadApp) {
        this.deferred = createDeferredApp(opts.loadApp)
      }
      return this.deferred
    }

    get app(): AppComponent {
      if (opts.app) return opts.app
      return this.ensureDeferred()!.component
    }

    override prefetchApp(): void {
      this.ensureDeferred()?.prefetch()
    }

    override onBeforeOpen(): boolean {
      this.prefetchApp()
      if (opts.beforeOpen) return opts.beforeOpen()
      return true
    }
  }

  return new DefinedAppWindow()
}

/**
 * 声明式注册内置应用（统一在 builtins.ts 调用）。
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

/** 批量注册内置应用 */
export function registerBuiltinApps(list: readonly RegisterBuiltinAppOptions[]): void {
  for (const opts of list) registerBuiltinApp(opts)
}
