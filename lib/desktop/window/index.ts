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
  refreshDesktopWindow,
  createDefaultWindows,
  createDefaultCoordinates,
  type RegisterDesktopWindowOptions,
} from './registry'
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
export * from './apps'
