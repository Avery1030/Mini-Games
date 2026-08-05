import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'
import { formatBest, LcdStat, pad3 } from './uiParts'
import type { SokobanState } from './types'

type Props = {
  state: SokobanState
  minMoves: number | null
  minMovesReady: boolean
  hasNextLevel: boolean
  labels: {
    won: string
    wonHint: string
    moves: string
    best: string
    playAgain: string
    nextLevel: string
    close: string
  }
  onReset: () => void
  onNextLevel: () => void
  onClose?: () => void
}

export function WinDialog({
  state,
  minMoves,
  minMovesReady,
  hasNextLevel,
  labels,
  onReset,
  onNextLevel,
  onClose,
}: Props) {
  return (
    <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 p-4'>
      <div
        className={cn(
          winChrome,
          'bg-chrome text-on-chrome px-5 py-4 min-w-[240px] max-w-[90%] text-center shadow-lg',
        )}
      >
        <p className='text-lg font-bold mb-1 text-green-800 dark:text-green-400'>{labels.won}</p>
        <p className='text-xs text-muted mb-1'>{labels.wonHint}</p>
        <div className='my-3 flex justify-center gap-3'>
          <LcdStat label={labels.moves} value={pad3(state.moves)} />
          <LcdStat
            label={labels.best}
            value={formatBest(minMovesReady, minMoves)}
            accent={minMoves != null && minMoves > 0 && state.moves <= minMoves}
          />
        </div>
        <div className='flex items-center justify-center gap-2 flex-wrap'>
          <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onReset}>
            {labels.playAgain}
          </button>
          {hasNextLevel ? (
            <button
              type='button'
              className={cn(winChrome, 'px-3 py-1.5 text-sm font-semibold')}
              onClick={onNextLevel}
            >
              {labels.nextLevel}
            </button>
          ) : null}
          {onClose ? (
            <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onClose}>
              {labels.close}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
