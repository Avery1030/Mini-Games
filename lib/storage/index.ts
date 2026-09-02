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
  WindowsPersistState,
  CoordinatesPersistState,
  NotepadPersistState,
  PaintPersistState,
  PaintToolPersist,
  KlineChartPersistState,
  WallpaperBootPersist,
  LockPersistState,
  CalendarPersistState,
  DesktopItemsPersistState,
  DesktopItemPersist,
  IdeSessionPersist,
  IdeSessionsPersistState,
  ExplorerSessionPersist,
  ExplorerSessionsPersistState,
  OfficeSessionWindowPersist,
  OfficeSessionsPersistState,
  OfficeKindPersist,
  OfficeFilePersist,
  OfficePersistState,
} from './schema'

export { appStorage } from './local'

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_STORAGE_KEYS,
  exportAppBackup,
  parseAppBackup,
  type AppBackupSnapshot,
  type ImportAppBackupResult,
} from './backup'
