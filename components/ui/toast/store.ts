import { create } from 'zustand'
import type { ToastEntry } from './types'

/** 同时最多展示的提示数；超出时移除最早的 */
export const TOAST_MAX = 15

type ToastState = {
  items: ToastEntry[]
  push: (entry: ToastEntry) => void
  remove: (id: string) => void
  clear: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (entry) => {
    set((s) => {
      const withoutDup = s.items.filter((t) => t.id !== entry.id)
      const next = [...withoutDup, entry]
      return {
        items: next.length > TOAST_MAX ? next.slice(next.length - TOAST_MAX) : next,
      }
    })
  },
  remove: (id) => {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }))
  },
  clear: () => set({ items: [] }),
}))
