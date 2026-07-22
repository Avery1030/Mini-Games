import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'
import {
  DEFAULT_INTERVAL,
  DEFAULT_OVERLAYS,
  DEFAULT_PANES,
  DEFAULT_SYMBOL,
  INTERVALS,
  OVERLAY_INDICATORS,
  PANE_INDICATORS,
  SYMBOLS,
  type BinanceInterval,
} from '@/features/KlineChartViewer/constants'

const SYMBOL_SET = new Set(SYMBOLS.map((s) => s.ticker))
const INTERVAL_SET = new Set(INTERVALS.map((i) => i.value))
const OVERLAY_SET = new Set(OVERLAY_INDICATORS.map((i) => i.name))
const PANE_SET = new Set(PANE_INDICATORS.map((i) => i.name))

function normalizeSymbol(value: unknown): string {
  return typeof value === 'string' && SYMBOL_SET.has(value) ? value : DEFAULT_SYMBOL.ticker
}

function normalizeInterval(value: unknown): BinanceInterval {
  return typeof value === 'string' && INTERVAL_SET.has(value as BinanceInterval)
    ? (value as BinanceInterval)
    : DEFAULT_INTERVAL.value
}

function normalizeList(value: unknown, allowed: Set<string>, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback]
  const next = value.filter((item): item is string => typeof item === 'string' && allowed.has(item))
  return [...new Set(next)]
}

function toggleInList(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((n) => n !== name) : [...list, name]
}

type KlineChartState = {
  symbol: string
  interval: BinanceInterval
  overlays: string[]
  panes: string[]
  drawingToolbarCollapsed: boolean
  setSymbol: (symbol: string) => void
  setInterval: (interval: BinanceInterval) => void
  toggleOverlay: (name: string) => void
  togglePane: (name: string) => void
  setOverlays: (overlays: string[]) => void
  setPanes: (panes: string[]) => void
  setDrawingToolbarCollapsed: (collapsed: boolean) => void
  toggleDrawingToolbarCollapsed: () => void
}

export const useKlineChartStore = create<KlineChartState>()(
  persist(
    (set) => ({
      symbol: DEFAULT_SYMBOL.ticker,
      interval: DEFAULT_INTERVAL.value,
      overlays: [...DEFAULT_OVERLAYS],
      panes: [...DEFAULT_PANES],
      drawingToolbarCollapsed: false,

      setSymbol: (symbol) => set({ symbol: normalizeSymbol(symbol) }),

      setInterval: (interval) => set({ interval: normalizeInterval(interval) }),

      toggleOverlay: (name) => {
        if (!OVERLAY_SET.has(name)) return
        set((state) => ({ overlays: toggleInList(state.overlays, name) }))
      },

      togglePane: (name) => {
        if (!PANE_SET.has(name)) return
        set((state) => ({ panes: toggleInList(state.panes, name) }))
      },

      setOverlays: (overlays) =>
        set({ overlays: normalizeList(overlays, OVERLAY_SET, [...DEFAULT_OVERLAYS]) }),

      setPanes: (panes) => set({ panes: normalizeList(panes, PANE_SET, [...DEFAULT_PANES]) }),

      setDrawingToolbarCollapsed: (collapsed) => set({ drawingToolbarCollapsed: collapsed }),

      toggleDrawingToolbarCollapsed: () =>
        set((state) => ({ drawingToolbarCollapsed: !state.drawingToolbarCollapsed })),
    }),
    {
      name: STORAGE_KEYS.klineChart,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (s) => ({
        symbol: s.symbol,
        interval: s.interval,
        overlays: s.overlays,
        panes: s.panes,
        drawingToolbarCollapsed: s.drawingToolbarCollapsed,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<KlineChartState> | undefined
        return {
          ...current,
          symbol: normalizeSymbol(saved?.symbol),
          interval: normalizeInterval(saved?.interval),
          overlays: normalizeList(saved?.overlays, OVERLAY_SET, [...DEFAULT_OVERLAYS]),
          panes: normalizeList(saved?.panes, PANE_SET, [...DEFAULT_PANES]),
          drawingToolbarCollapsed: saved?.drawingToolbarCollapsed === true,
        }
      },
    },
  ),
)
