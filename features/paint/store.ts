import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

export type PaintTool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse'

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
    },
  ),
)
