import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_NOTE_LEN = 500

type CalendarState = {
  /** 按日备注，key 为 yyyy-MM-dd */
  notes: Record<string, string>
  setNote: (dateKey: string, text: string) => void
  clearNote: (dateKey: string) => void
}

function normalizeNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY_RE.test(k) || typeof v !== 'string') continue
    const trimmed = v.trim().slice(0, MAX_NOTE_LEN)
    if (trimmed) out[k] = trimmed
  }
  return out
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      notes: {},
      setNote: (dateKey, text) => {
        if (!DATE_KEY_RE.test(dateKey)) return
        const trimmed = text.trim().slice(0, MAX_NOTE_LEN)
        const notes = { ...get().notes }
        if (!trimmed) {
          delete notes[dateKey]
        } else {
          notes[dateKey] = trimmed
        }
        set({ notes })
      },
      clearNote: (dateKey) => {
        if (!DATE_KEY_RE.test(dateKey) || !(dateKey in get().notes)) return
        const notes = { ...get().notes }
        delete notes[dateKey]
        set({ notes })
      },
    }),
    {
      name: STORAGE_KEYS.calendar,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({ notes: s.notes }),
      merge: (persisted, current) => {
        const saved = persisted as { notes?: unknown } | undefined
        return {
          ...current,
          notes: normalizeNotes(saved?.notes),
        }
      },
    },
  ),
)

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
