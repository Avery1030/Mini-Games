import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const PAINT_KEY = 'desktop-paint'

export type PaintTool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse'

type PaintState = {
  lastDrawingId: string | null
  tool: PaintTool
  color: string
  brushSize: number
  setLastDrawingId: (id: string | null) => void
  setTool: (tool: PaintTool) => void
  setColor: (color: string) => void
  setBrushSize: (size: number) => void
}

export const usePaintStore = create<PaintState>()(
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
      name: PAINT_KEY,
      partialize: (s) => ({
        lastDrawingId: s.lastDrawingId,
        tool: s.tool,
        color: s.color,
        brushSize: s.brushSize,
      }),
    },
  ),
)
