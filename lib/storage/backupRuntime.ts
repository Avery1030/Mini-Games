import {
  downloadAppBackupJson,
  exportAppBackup,
  readBackupFile,
  writeAppBackupToStorage,
  type ImportAppBackupResult,
} from './backup'

type PersistApi = {
  rehydrate: () => Promise<void> | void
}

/**
 * 动态加载各 persist store 再 rehydrate，避免 backupRuntime 顶层 import store
 * 造成与 desktop window registry 的循环依赖。
 */
async function rehydrateAllStores(): Promise<void> {
  const [
    { useDesktopStore },
    { useDesktopItemsStore },
    { useWindowStore },
    { useSettingsStore },
    { useNotepadStore },
    { usePaintStore },
    { useKlineChartStore },
    { useCalendarStore },
    { useOfficeStore },
  ] = await Promise.all([
    import('@/store/desktop'),
    import('@/store/desktopItems'),
    import('@/store/window'),
    import('@/store/settings'),
    import('@/features/notepad/store'),
    import('@/features/paint/store'),
    import('@/features/kline-chart/store'),
    import('@/store/calendar'),
    import('@/features/office/store'),
  ])

  const order: PersistApi[] = [
    useDesktopStore.persist,
    useDesktopItemsStore.persist,
    useWindowStore.persist,
    useSettingsStore.persist,
    useNotepadStore.persist,
    usePaintStore.persist,
    useKlineChartStore.persist,
    useCalendarStore.persist,
    useOfficeStore.persist,
  ]

  for (const store of order) {
    await store.rehydrate()
  }
}

/** 导出当前全部可备份状态并下载 JSON */
export function exportAndDownloadAppBackup(): void {
  downloadAppBackupJson(exportAppBackup())
}

/**
 * 从文件导入：写入 storage（覆盖）→ rehydrate 内存 store，立即生效。
 * 返回主题，便于 UI 同步 next-themes。
 */
export async function importAppBackupFromFile(file: File): Promise<ImportAppBackupResult> {
  const snapshot = await readBackupFile(file)
  const result = writeAppBackupToStorage(snapshot)
  await rehydrateAllStores()
  return result
}

export type { AppBackupSnapshot, ImportAppBackupResult } from './backup'
export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BACKUP_STORAGE_KEYS,
  exportAppBackup,
  parseAppBackup,
} from './backup'
