/** object URL 缓存：同一 key 只 create 一次，避免误 revoke 仍在使用的地址 */

const cache = new Map<string, string>()

export function rememberObjectUrl(key: string, blob: Blob): string {
  const prev = cache.get(key)
  if (prev) return prev
  const url = URL.createObjectURL(blob)
  cache.set(key, url)
  return url
}

export function getCachedObjectUrl(key: string): string | undefined {
  return cache.get(key)
}

/** 是否为本会话内由我们 create 且仍有效的 blob URL */
export function isLiveObjectUrl(url: string): boolean {
  if (!url.startsWith('blob:')) return false
  for (const cached of cache.values()) {
    if (cached === url) return true
  }
  return false
}

export function revokeObjectUrl(key: string): void {
  const prev = cache.get(key)
  if (!prev) return
  URL.revokeObjectURL(prev)
  cache.delete(key)
}
