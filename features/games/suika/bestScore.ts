import { STORAGE_KEYS, appStorage } from '@/lib/storage'

export function readBest(): number {
  const n = Number(appStorage.getRaw(STORAGE_KEYS.suikaBest) || 0)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}

export function writeBest(score: number): void {
  appStorage.setRaw(STORAGE_KEYS.suikaBest, String(score))
}
