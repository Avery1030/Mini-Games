import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'

type Props = {
  mode: 'won' | 'lost'
  elapsed: number
  bestTime: number | null
  hasNextLevel: boolean
  labels: {
    won: string
    lost: string
    wonHint: string
    lostHint: string
    time: string
    bestTime: string
    playAgain: string
    nextLevel: string
    levelSelect: string
  }
  formatTime: (sec: number) => string
  onReset: () => void
  onNextLevel: () => void
  onLevelSelect: () => void
}

export function WinDialog({
  mode,
  elapsed,
  bestTime,
  hasNextLevel,
  labels,
  formatTime,
  onReset,
  onNextLevel,
  onLevelSelect,
}: Props) {
  const title = mode === 'won' ? labels.won : labels.lost
  const hint = mode === 'won' ? labels.wonHint : labels.lostHint
  const shownBest = bestTime != null ? Math.min(bestTime, elapsed) : elapsed

  return (
    <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60 p-4'>
      <div
        className={cn(
          winChrome,
          'bg-chrome text-on-chrome px-5 py-4 min-w-[240px] max-w-[90%] text-center shadow-lg',
        )}
      >
        <p
          className={cn(
            'text-lg font-bold mb-1',
            mode === 'won' ? 'text-green-800 dark:text-green-400' : 'text-red-700 dark:text-red-400',
          )}
        >
          {title}
        </p>
        <p className='text-xs text-muted mb-1'>{hint}</p>
        <p className='text-xs text-muted mb-3 tabular-nums'>
          {labels.time}: {formatTime(elapsed)}
          {mode === 'won' ? ` · ${labels.bestTime}: ${formatTime(shownBest)}` : ''}
        </p>
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
          <button type='button' className={cn(winChrome, 'px-3 py-1.5 text-sm')} onClick={onLevelSelect}>
            {labels.levelSelect}
          </button>
        </div>
      </div>
    </div>
  )
}
