import { STORAGE_KEYS, appStorage } from '@/lib/storage'

export function readFormatOnSavePref(): boolean {
  const raw = appStorage.getRaw(STORAGE_KEYS.ideFormatOnSave)
  if (raw == null) return true
  return raw === '1'
}

export function writeFormatOnSavePref(value: boolean): void {
  appStorage.setRaw(STORAGE_KEYS.ideFormatOnSave, value ? '1' : '0')
}
