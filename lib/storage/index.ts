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
  WallpaperBootPersist,
  LegacyDesktopPersistState,
  LockPersistState,
  CalendarPersistState,
  DemoAppsPersistState,
  DemoBridgeRecord,
  DemoFoundryItem,
  DemoEmailDraft,
} from './schema'

export { appStorage } from './local'

export {
  migrateLegacyDesktopPersist,
  WINDOWS_KEY,
  COORDINATES_KEY,
} from './migrateLegacy'
