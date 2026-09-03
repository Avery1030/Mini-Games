/**
 * 跨业务通用 Hooks（不依赖桌面 store / VFS / 具体 App）。
 * 后续抽离工具库时以本文件为导出面；桌面专用见 `hooks/desktop`。
 */
export { useMetaHotkeys, type MetaHotkeyHandlers } from './useMetaHotkeys'
export { useSilentAutoSave } from './useSilentAutoSave'
export { useMediaQuery, useIsMobileViewport, MOBILE_VIEWPORT_QUERY } from './useMediaQuery'
export { useCopyClipboard } from './useCopyClipboard'
export {
  useWebSocket,
  createManagedWebSocket,
  DEFAULT_PERMANENT_CLOSE_CODES,
  type UseWebSocketOptions,
  type ConnectionStatus,
  type ManagedWebSocket,
  type ManagedWebSocketError,
  type ManagedWebSocketOptions,
} from './useWebSocket'
