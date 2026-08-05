import { ChevronLeft, ChevronRight, RefreshCw, RotateCcw, Undo2 } from 'lucide-react'
import { Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'
import type { CrackPhase } from './useCrackDemo'
import { formatBest, LcdStat, pad3 } from './uiParts'
import type { SokobanState } from './types'

type Labels = {
  moves: string
  best: string
  undo: string
  reset: string
  crack: string
  crackPause: string
  crackResume: string
  close: string
  level: string
  levelN: (n: number) => string
  prevLevel: string
  nextLevel: string
  reloadLevel: string
}

type Props = {
  labels: Labels
  state: SokobanState | null
  minMoves: number | null
  minMovesReady: boolean
  catalog: number[]
  levelId: number | null
  loading: boolean
  crackEnabled: boolean
  crackPhase: CrackPhase
  onClose?: () => void
  onUndo: () => void
  onReset: () => void
  onCrackStart: () => void
  onCrackPause: () => void
  onCrackResume: () => void
  onSelectLevel: (id: string) => void
  onAdjacentLevel: (delta: number) => void
  onReloadLevels: () => void
}

export function Toolbar({
  labels,
  state,
  minMoves,
  minMovesReady,
  catalog,
  levelId,
  loading,
  crackEnabled,
  crackPhase,
  onClose,
  onUndo,
  onReset,
  onCrackStart,
  onCrackPause,
  onCrackResume,
  onSelectLevel,
  onAdjacentLevel,
  onReloadLevels,
}: Props) {
  const demoBusy = crackPhase !== 'idle'
  const selectOptions = catalog.map((id) => ({
    value: String(id),
    label: labels.levelN(id),
  }))

  return (
    <div className={cn(winChromePanel, 'mx-2 mt-2 px-2 py-1.5 flex flex-col gap-1.5 shrink-0')}>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 shrink-0'>
          <LcdStat label={labels.moves} value={pad3(state?.moves ?? 0)} />
          <LcdStat
            label={labels.best}
            value={formatBest(minMovesReady, minMoves)}
            accent={minMoves != null && minMoves > 0 && (state?.moves ?? 0) > 0 && (state?.moves ?? 0) <= minMoves}
          />
        </div>

        <div className='flex items-center gap-1 shrink-0'>
          <button
            type='button'
            className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-40')}
            disabled={!state || state.undoStack.length === 0 || state.won || demoBusy}
            onClick={onUndo}
          >
            <Undo2 size={12} aria-hidden />
            {labels.undo}
          </button>
          <button
            type='button'
            className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs disabled:opacity-40')}
            disabled={!state || demoBusy}
            onClick={onReset}
          >
            <RotateCcw size={12} aria-hidden />
            {labels.reset}
          </button>
          {crackEnabled ? (
            crackPhase === 'playing' ? (
              <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onCrackPause}>
                {labels.crackPause}
              </button>
            ) : crackPhase === 'paused' ? (
              <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onCrackResume}>
                {labels.crackResume}
              </button>
            ) : (
              <button
                type='button'
                className={cn(winChrome, 'h-7 px-2 text-xs disabled:opacity-40')}
                disabled={!state || state.won || loading}
                onClick={onCrackStart}
              >
                {labels.crack}
              </button>
            )
          ) : null}
          {onClose ? (
            <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onClose}>
              {labels.close}
            </button>
          ) : null}
        </div>
      </div>

      <div className='flex items-center justify-center gap-1'>
        <button
          type='button'
          className={cn(winChrome, 'h-7 w-7 shrink-0 inline-flex items-center justify-center disabled:opacity-40')}
          disabled={catalog.length < 2 || loading || demoBusy}
          aria-label={labels.prevLevel}
          onClick={() => onAdjacentLevel(-1)}
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        <Select
          size='md'
          className='w-[8rem] shrink-0'
          aria-label={labels.level}
          value={levelId == null ? '' : String(levelId)}
          disabled={loading || catalog.length === 0 || demoBusy}
          onValueChange={onSelectLevel}
          options={selectOptions}
        />
        <button
          type='button'
          className={cn(winChrome, 'h-7 w-7 shrink-0 inline-flex items-center justify-center disabled:opacity-40')}
          disabled={catalog.length < 2 || loading || demoBusy}
          aria-label={labels.nextLevel}
          onClick={() => onAdjacentLevel(1)}
        >
          <ChevronRight size={14} aria-hidden />
        </button>
        <button
          type='button'
          className={cn(winChrome, 'h-7 w-7 shrink-0 inline-flex items-center justify-center disabled:opacity-40')}
          disabled={loading || demoBusy}
          aria-label={labels.reloadLevel}
          title={labels.reloadLevel}
          onClick={onReloadLevels}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} aria-hidden />
        </button>
      </div>
    </div>
  )
}
