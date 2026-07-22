export {
  STORAGE_KEYS,
  STORAGE_KEY_LIST,
  isStorageKey,
  type StorageKey,
} from './keys'

export type {
  StorageSchema,
  JsonStorageKey,
  ThemeStorageValue,
  ZustandPersistEnvelope,
  SettingsPersistState,
  SettingsGalleryItemPersist,
  WindowsPersistState,
  CoordinatesPersistState,
  NotepadPersistState,
  PaintPersistState,
  PaintToolPersist,
  KlineChartPersistState,
  WallpaperBootPersist,
  LegacyDesktopPersistState,
  LockPersistState,
  CalendarPersistState,
  DesktopFolderPersist,
  DesktopItemsPersistState,
} from './schema'

export { appStorage } from './local'

export {
  migrateLegacyDesktopPersist,
  WINDOWS_KEY,
  COORDINATES_KEY,
} from './migrateLegacy'

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_STORAGE_KEYS,
  exportAppBackup,
  parseAppBackup,
  type AppBackupSnapshot,
  type ImportAppBackupResult,
} from './backup'
