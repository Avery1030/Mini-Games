/** 记事本：外部请求打开指定笔记 id（如回收站预览） */

type OpenListener = (id: string) => void

let pendingNoteId: Nullable<string> = null
const listeners = new Set<OpenListener>()

export function requestOpenNote(id: string): void {
  if (listeners.size > 0) {
    for (const listener of listeners) {
      listener(id)
    }
    return
  }
  pendingNoteId = id
}

export function takePendingOpenNote(): Nullable<string> {
  const id = pendingNoteId
  pendingNoteId = null
  return id
}

export function subscribeOpenNote(listener: OpenListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
