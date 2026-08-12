import { ChevronLeft, Pause, Play, Settings } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'
import { MAX_MISTAKES, formatElapsed } from './sudoku-game'

type HeaderProps = {
  title: string
  backLabel: string
  settingsLabel: string
  settingsDisabled: boolean
  onBack: () => void
  onOpenSettings: () => void
}

export function PlayHeader({
  title,
  backLabel,
  settingsLabel,
  settingsDisabled,
  onBack,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className='shrink-0 flex items-center justify-between gap-2 px-2 pt-2 pb-1'>
      <button
        type='button'
        onClick={onBack}
        className={cn(winChrome, 'h-8 w-8 inline-flex items-center justify-center')}
        aria-label={backLabel}
      >
        <ChevronLeft size={18} strokeWidth={2.25} />
      </button>
      <h1 className='text-sm font-bold tracking-wide'>{title}</h1>
      <button
        type='button'
        onClick={onOpenSettings}
        disabled={settingsDisabled}
        className={cn(winChrome, 'h-8 w-8 inline-flex items-center justify-center disabled:opacity-40')}
        title={settingsLabel}
        aria-label={settingsLabel}
      >
        <Settings size={16} strokeWidth={2} />
      </button>
    </header>
  )
}

type StatusProps = {
  difficultyLabel: string
  mistakesLabel: string
  mistakes: number
  elapsed: number
  paused: boolean
  pauseLabel: string
  resumeLabel: string
  pauseDisabled: boolean
  onTogglePause: () => void
}

export function StatusBar({
  difficultyLabel,
  mistakesLabel,
  mistakes,
  elapsed,
  paused,
  pauseLabel,
  resumeLabel,
  pauseDisabled,
  onTogglePause,
}: StatusProps) {
  return (
    <div className={cn(winChromePanel, 'mx-2 px-2 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0')}>
      <span className='font-medium'>{difficultyLabel}</span>
      <span>
        {mistakesLabel}
        <span className='font-semibold text-green-800 dark:text-green-400'>
          {mistakes}/{MAX_MISTAKES}
        </span>
      </span>
      <div className='flex items-center gap-1.5 tabular-nums font-medium'>
        <span>{formatElapsed(elapsed)}</span>
        <button
          type='button'
          onClick={onTogglePause}
          disabled={pauseDisabled}
          className={cn(winChrome, 'h-6 w-6 inline-flex items-center justify-center disabled:opacity-40')}
          aria-label={paused ? resumeLabel : pauseLabel}
        >
          {paused ? <Play size={12} strokeWidth={2.5} /> : <Pause size={12} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  )
}
