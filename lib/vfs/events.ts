const listeners = new Set<() => void>()
let timer: Nullable<ReturnType<typeof setTimeout>> = null

/** VFS 变更订阅（store 用来刷新目录，避免 vfs.ts 直接依赖 store） */
export function subscribeVfsChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 合并同一轮的多次写入，再通知 */
export function emitVfsChange(): void {
  if (typeof window === 'undefined') return
  if (timer != null) return
  timer = setTimeout(() => {
    timer = null
    for (const listener of listeners) listener()
  }, 16)
}
