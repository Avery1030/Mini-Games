export {
  DesktopWindow,
  DEFAULT_WINDOW_CHROME,
  registerWindowController,
  ensureWindowSlot,
  removeWindowSlot,
  type DesktopIconComponent,
  type WindowController,
} from './DesktopWindow'
export {
  DESKTOP_WINDOWS,
  getDesktopWindow,
  getAppDefinition,
  getDesktopAppDefinitions,
  getDesktopAppDefinitionsSnapshot,
  getDesktopWindowsSnapshot,
  listDesktopWindows,
  subscribeDesktopRegistry,
  registerDesktopWindow,
  unregisterDesktopWindow,
  registerDesktopCoordController,
  isDynamicDesktopWindow,
  isBuiltinAppId,
  pushBuiltinWindow,
  refreshDesktopWindow,
  createDefaultWindows,
  createDefaultCoordinates,
  type RegisterDesktopWindowOptions,
} from './registry'
export {
  defineDesktopApp,
  registerBuiltinApp,
  registerBuiltinApps,
  createDeferredApp,
  type RegisterBuiltinAppOptions,
  type LoadAppFn,
  type AppComponent,
  type DeferredApp,
} from './defineApp'
export {
  createDesktopFolderWindow,
  createDesktopTextDocumentWindow,
  removeDesktopItemWindow,
  renameDesktopItemWindow,
  resolveDesktopItemTitle,
  allocateDesktopCoordinate,
  type CreateDesktopFolderOptions,
  type CreateDesktopTextDocumentOptions,
} from './createFolder'
export { FolderWindow, TextDocumentWindow } from './apps'
export {
  IdeEditorWindow,
  HtmlPreviewWindow,
  spawnIdeEditor,
  openIdeFile,
  spawnHtmlPreview,
  getIdeEditorWindow,
  getHtmlPreviewWindow,
  restorePersistedIdeSessions,
  ensureIdeEditorWindow,
} from './ideWindows'
export {
  prefetchApps,
  scheduleIdlePrefetchBuiltinApps,
} from './prefetchApps'

/** 加载全部内置应用注册（必须在 createDefaultWindows 等之前执行） */
import './builtins'
