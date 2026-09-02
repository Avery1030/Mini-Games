import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import { PaintPersistSchema, type PaintTool } from './schema'

export type { PaintTool }

interface PaintState {
  lastDrawingId: Nullable<string>
  tool: PaintTool
  color: string
  brushSize: number
}

interface PaintActions {
  setLastDrawingId: (id: Nullable<string>) => void
  setTool: (tool: PaintTool) => void
  setColor: (color: string) => void
  setBrushSize: (size: number) => void
}

export type PaintStore = PaintState & PaintActions

export const usePaintStore = create<PaintStore>()(
  persist(
    (set) => ({
      lastDrawingId: null,
      tool: 'brush',
      color: '#000000',
      brushSize: 4,
      setLastDrawingId: (id) => set({ lastDrawingId: id }),
      setTool: (tool) => set({ tool }),
      setColor: (color) => set({ color }),
      setBrushSize: (brushSize) => set({ brushSize }),
    }),
    {
      name: STORAGE_KEYS.paint,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        lastDrawingId: s.lastDrawingId,
        tool: s.tool,
        color: s.color,
        brushSize: s.brushSize,
      }),
      merge: (persisted, current) => {
        const parsed = PaintPersistSchema.safeParse(persisted)
        if (!parsed.success) return current
        return {
          ...current,
          ...(parsed.data.lastDrawingId !== undefined ? { lastDrawingId: parsed.data.lastDrawingId } : {}),
          ...(parsed.data.tool !== undefined ? { tool: parsed.data.tool } : {}),
          ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
          ...(parsed.data.brushSize !== undefined ? { brushSize: parsed.data.brushSize } : {}),
        }
      },
    },
  ),
)
