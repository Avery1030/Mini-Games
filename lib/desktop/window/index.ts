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
  DESKTOP_APP_DEFINITIONS,
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
  removeDesktopFolderWindow,
  renameDesktopFolderWindow,
  resolveDesktopItemTitle,
  allocateDesktopCoordinate,
  isFolderTitleTaken,
  type CreateDesktopFolderOptions,
} from './createFolder'
export * from './apps'
