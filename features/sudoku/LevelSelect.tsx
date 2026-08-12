'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'

export type LevelSelectItem = {
  id: number
  index: number
  unlocked: boolean
  /** 最佳通关用时（秒）；未通关为 null */
  bestTime: number | null
  clues: number
}

type Props = {
  items: LevelSelectItem[]
  empty: boolean
  labels: {
    title: string
    hint: string
    empty: string
    levelN: (n: number) => string
    locked: string
    cleared: string
    bestTime: string
    clues: string
    back: string
  }
  onPick: (id: number) => void
  onBack: () => void
  formatTime: (sec: number) => string
}

export function LevelSelect({ items, empty, labels, onPick, onBack, formatTime }: Props) {
  return (
    <div className='flex h-full min-h-0 flex-col bg-chrome text-on-chrome p-3 gap-2'>
      <div className={cn(winChromePanel, 'px-3 py-2 flex items-start gap-2')}>
        <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs shrink-0')} onClick={onBack}>
          {labels.back}
        </button>
        <div className='min-w-0'>
          <h2 className='text-sm font-bold'>{labels.title}</h2>
          <p className='mt-0.5 text-[11px] text-muted'>{labels.hint}</p>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-auto'>
        {empty ? (
          <p className='text-xs text-muted px-1'>{labels.empty}</p>
        ) : (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 items-stretch'>
            {items.map((item) => {
              const locked = !item.unlocked
              const cleared = item.bestTime != null
              return (
                <button
                  key={item.id}
                  type='button'
                  disabled={locked}
                  onClick={() => onPick(item.id)}
                  className={cn(
                    winChrome,
                    'flex h-full min-h-[5.75rem] flex-col items-start gap-1 px-2.5 py-2 text-left disabled:opacity-55 disabled:cursor-not-allowed',
                  )}
                >
                  <div className='flex w-full items-center justify-between gap-1'>
                    <span className='text-xs font-bold'>{labels.levelN(item.index)}</span>
                    {locked ? (
                      <Lock size={12} className='shrink-0 text-muted' aria-label={labels.locked} />
                    ) : cleared ? (
                      <span className='text-[10px] text-green-800 dark:text-green-400'>{labels.cleared}</span>
                    ) : null}
                  </div>
                  <div className='mt-auto flex w-full flex-col gap-0.5 text-[10px] text-muted leading-snug'>
                    <span>
                      {labels.clues}: {item.clues}
                    </span>
                    <span>
                      {labels.bestTime}:{' '}
                      {item.bestTime != null
                        ? formatTime(item.bestTime)
                        : locked
                          ? labels.locked
                          : '—'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
