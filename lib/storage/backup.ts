import { STORAGE_KEYS, STORAGE_KEY_LIST, isSplitStorageKey, isStorageKey, type StorageKey } from './keys'
import { appStorage } from './local'

/** 备份文件标识，用于校验导入内容 */
export const BACKUP_FORMAT = 'mini-windows-desktop-backup' as const
export const BACKUP_VERSION = 1

/**
 * 参与导入导出的 storage key。
 * - 排除 lock：锁屏会话绑定本机临时密码，跨设备还原无意义且可能误锁
 */
export const BACKUP_STORAGE_KEYS: StorageKey[] = STORAGE_KEY_LIST.filter((key) => key !== STORAGE_KEYS.lock)

export type AppBackupSnapshot = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  entries: Partial<Record<StorageKey, unknown>>
}

export type ImportAppBackupResult = {
  /** 导入后的主题（若备份中有） */
  theme: Nullable<'light' | 'dark'>
  /** 实际写入的 key 数量 */
  appliedKeys: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRawStringKey(key: StorageKey): boolean {
  return (
    key === STORAGE_KEYS.theme ||
    key === STORAGE_KEYS.suikaBest ||
    key === STORAGE_KEYS.ideFormatOnSave ||
    isSplitStorageKey(key)
  )
}

function serializeEntry(key: StorageKey, value: unknown): string {
  if (isRawStringKey(key)) {
    if (typeof value !== 'string') {
      throw new Error(`Invalid string value for ${key}`)
    }
    if (key === STORAGE_KEYS.theme && value !== 'light' && value !== 'dark') {
      throw new Error(`Invalid theme value for ${key}`)
    }
    if (key === STORAGE_KEYS.ideFormatOnSave && value !== '0' && value !== '1') {
      throw new Error(`Invalid ide formatOnSave value for ${key}`)
    }
    return value
  }
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseStoredRaw(key: StorageKey, raw: string): unknown {
  if (isRawStringKey(key)) return raw
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return raw
  }
}

/** 从当前 localStorage 收集可备份状态 */
export function exportAppBackup(): AppBackupSnapshot {
  const entries: Partial<Record<StorageKey, unknown>> = {}
  for (const key of BACKUP_STORAGE_KEYS) {
    const raw = appStorage.getRaw(key)
    if (raw == null) continue
    entries[key] = parseStoredRaw(key, raw)
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  }
}

/** 校验并归一化导入 JSON */
export function parseAppBackup(input: unknown): AppBackupSnapshot {
  if (!isPlainObject(input)) {
    throw new Error('Backup must be a JSON object')
  }
  if (input.format !== BACKUP_FORMAT) {
    throw new Error('Unrecognized backup format')
  }
  if (typeof input.version !== 'number' || input.version < 1) {
    throw new Error('Unsupported backup version')
  }
  if (!isPlainObject(input.entries)) {
    throw new Error('Backup entries must be an object')
  }

  const entries: Partial<Record<StorageKey, unknown>> = {}
  for (const [key, value] of Object.entries(input.entries)) {
    if (!isStorageKey(key)) continue
    if (!BACKUP_STORAGE_KEYS.includes(key)) continue
    if (value === undefined) continue
    entries[key] = value
  }

  return {
    format: BACKUP_FORMAT,
    version: input.version,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString(),
    entries,
  }
}

/**
 * 将备份写入 storage（覆盖同名 key，导入优先于当前 store），
 * 再由调用方 rehydrate 各 zustand store 使内存立即生效。
 */
export function writeAppBackupToStorage(snapshot: AppBackupSnapshot): ImportAppBackupResult {
  let appliedKeys = 0
  let theme: Nullable<'light' | 'dark'> = null

  for (const key of BACKUP_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(snapshot.entries, key)) continue
    const value = snapshot.entries[key]
    if (value === undefined) continue

    const raw = serializeEntry(key, value)
    appStorage.setRaw(key, raw)
    appliedKeys += 1

    if (key === STORAGE_KEYS.theme && (raw === 'light' || raw === 'dark')) {
      theme = raw
    }
  }

  return { theme, appliedKeys }
}

export function downloadAppBackupJson(snapshot: AppBackupSnapshot, filename?: string): void {
  const day = snapshot.exportedAt.slice(0, 10)
  const name = filename ?? `avery-mini-app-backup-${day || 'export'}.json`
  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function readBackupFile(file: File): Promise<AppBackupSnapshot> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('Invalid JSON file')
  }
  return parseAppBackup(parsed)
}
