import type { OfficeKind } from './schema'

type OpenListener = (id: string) => void

const pending: Record<OfficeKind, Nullable<string>> = { writer: null, sheet: null }
const listeners: Record<OfficeKind, Set<OpenListener>> = {
  writer: new Set(),
  sheet: new Set(),
}

/** 资源管理器 / 桌面：请求用 Writer 或表格打开指定 VFS 文件 */
export function requestOpenOfficeFile(kind: OfficeKind, id: string): void {
  if (listeners[kind].size > 0) {
    for (const listener of listeners[kind]) listener(id)
    return
  }
  pending[kind] = id
}

export function takePendingOpenOfficeFile(kind: OfficeKind): Nullable<string> {
  const id = pending[kind]
  pending[kind] = null
  return id
}

export function subscribeOpenOfficeFile(kind: OfficeKind, listener: OpenListener): () => void {
  listeners[kind].add(listener)
  return () => {
    listeners[kind].delete(listener)
  }
}
