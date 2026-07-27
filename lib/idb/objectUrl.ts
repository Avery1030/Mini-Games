/** object URL 缓存：避免同一 Blob 重复 createObjectURL */

const cache = new Map<string, string>()

export function rememberObjectUrl(key: string, blob: Blob): string {
  const prev = cache.get(key)
  if (prev) URL.revokeObjectURL(prev)
  const url = URL.createObjectURL(blob)
  cache.set(key, url)
  return url
}

export function getCachedObjectUrl(key: string): string | undefined {
  return cache.get(key)
}

export function revokeObjectUrl(key: string): void {
  const prev = cache.get(key)
  if (!prev) return
  URL.revokeObjectURL(prev)
  cache.delete(key)
}
