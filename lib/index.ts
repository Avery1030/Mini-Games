/**
 * 通用基础设施（无桌面壳、无具体 App）。
 * 独立打包对照：
 * - 本文件：格式化 / id / http / 环境 / className
 * - `@/lib/storage`：localStorage 适配（key 表仍属本应用）
 * - `@/lib/vfs`：虚拟文件系统
 * - `@/components/ui`：复古 UI
 * - `@/hooks`：通用 hooks
 * - `@/features/games/engine`：Canvas 几何与物理
 * 桌面窗口壳见 `@/lib/desktop`（本产品业务层）。
 */
export { formatBytes, formatShortDateTime, formatOptionalShortDateTime } from './format'
export { createUuid, createWindowIdSuffix } from './id'
export { cn } from './cn'
export { isClient, isServer } from './env'
export { winChrome, winChromePanel, winChromePressed, winChromeSunken } from './winChrome'
export {
  appStorage,
  STORAGE_KEYS,
  isStorageKey,
  type StorageKey,
  type StorageSchema,
  type ThemeStorageValue,
} from './storage'
export {
  http,
  createHttp,
  HttpError,
  type HttpClient,
  type HttpRequestConfig,
  type HttpMethod,
  type HttpResponseType,
  type HttpQuery,
  type HttpBody,
  type HttpInstanceConfig,
} from './http'
