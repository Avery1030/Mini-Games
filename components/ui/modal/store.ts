import { create } from 'zustand'
import type { ModalCloseReason, ModalEntry } from './types'

const Z_BASE = 10000
const Z_STEP = 20

type ModalState = {
  stack: ModalEntry[]
  push: (entry: ModalEntry) => void
  remove: (id: string, reason: ModalCloseReason, actionId?: string) => void
  clear: () => void
}

export const useModalStore = create<ModalState>((set, get) => ({
  stack: [],
  push: (entry) => {
    set((s) => ({ stack: [...s.stack, entry] }))
    queueMicrotask(() => entry.onOpen?.())
  },
  remove: (id, reason, actionId) => {
    const entry = get().stack.find((m) => m.id === id)
    if (!entry) return
    set((s) => ({ stack: s.stack.filter((m) => m.id !== id) }))
    entry.onClose?.({ reason, actionId })
  },
  clear: () => {
    const { stack } = get()
    set({ stack: [] })
    for (const entry of [...stack].reverse()) {
      entry.onClose?.({ reason: 'close' })
    }
  },
}))

export function modalZIndex(stackIndex: number): number {
  return Z_BASE + stackIndex * Z_STEP
}

export function topModalId(): string | undefined {
  const stack = useModalStore.getState().stack
  return stack[stack.length - 1]?.id
}
