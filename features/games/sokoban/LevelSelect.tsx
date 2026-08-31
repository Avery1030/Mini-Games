'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'
import { formatStars } from './stars'

export type LevelSelectItem = {
  id: number
  unlocked: boolean
  stars: number
  bestMoves: Nullable<number>
}

type Props = {
  items: LevelSelectItem[]
  loading: boolean
  loadError: Nullable<string>
  labels: {
    title: string
    hint: string
    levelN: (n: number) => string
    locked: string
    cleared: string
    loading: string
    loadFailed: string
    bestMoves: string
  }
  onPick: (id: number) => void
}

/** 开局选关：需通关前置关才解锁 */
export function LevelSelect({ items, loading, loadError, labels, onPick }: Props) {
  return (
    <div className='flex h-full min-h-0 flex-col bg-chrome text-on-chrome p-3 gap-2'>
      <div className={cn(winChromePanel, 'px-3 py-2')}>
        <h2 className='text-sm font-bold'>{labels.title}</h2>
        <p className='mt-0.5 text-[11px] text-muted'>{labels.hint}</p>
      </div>

      <div className='min-h-0 flex-1 overflow-auto'>
        {loading ? (
          <p className='text-xs text-muted px-1'>{labels.loading}</p>
        ) : loadError ? (
          <p className='text-xs text-red-700 dark:text-red-400 px-1'>{labels.loadFailed}</p>
        ) : (
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {items.map((item) => {
              const locked = !item.unlocked
              return (
                <button
                  key={item.id}
                  type='button'
                  disabled={locked}
                  onClick={() => onPick(item.id)}
                  className={cn(
                    winChrome,
                    'flex flex-col items-start gap-1 px-2.5 py-2 text-left disabled:opacity-55 disabled:cursor-not-allowed',
                    !locked && 'hover:brightness-105',
                  )}
                >
                  <div className='flex w-full items-center justify-between gap-1'>
                    <span className='text-xs font-bold'>{labels.levelN(item.id)}</span>
                    {locked ? (
                      <Lock size={12} className='shrink-0 text-muted' aria-label={labels.locked} />
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      'text-[13px] tracking-wide',
                      item.stars > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted',
                    )}
                    aria-label={item.stars > 0 ? labels.cleared : labels.locked}
                  >
                    {formatStars(item.stars)}
                  </div>
                  {item.bestMoves != null ? (
                    <span className='text-[10px] text-muted'>
                      {labels.bestMoves}: {item.bestMoves}
                    </span>
                  ) : (
                    <span className='text-[10px] text-muted'>
                      {locked ? labels.locked : '—'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
