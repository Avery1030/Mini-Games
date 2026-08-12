'use client'

import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'
import type { Difficulty } from './types'
import { DIFFICULTIES } from './types'

export type DifficultySelectItem = {
  difficulty: Difficulty
  levelCount: number
  clearedCount: number
}

type Props = {
  items: DifficultySelectItem[]
  labels: {
    title: string
    hint: string
    levels: string
    cleared: string
    difficulty: Record<Difficulty, string>
    difficultyHint: Record<Difficulty, string>
  }
  onPick: (difficulty: Difficulty) => void
}

export function DifficultySelect({ items, labels, onPick }: Props) {
  const byKey = new Map(items.map((i) => [i.difficulty, i]))

  return (
    <div className='flex h-full min-h-0 flex-col bg-chrome text-on-chrome p-3 gap-2'>
      <div className={cn(winChromePanel, 'px-3 py-2')}>
        <h2 className='text-sm font-bold'>{labels.title}</h2>
        <p className='mt-0.5 text-[11px] text-muted'>{labels.hint}</p>
      </div>

      <div className='min-h-0 flex-1 overflow-auto'>
        <div className='flex flex-col gap-2'>
          {DIFFICULTIES.map((d) => {
            const item = byKey.get(d)
            if (!item) return null
            return (
              <button
                key={d}
                type='button'
                onClick={() => onPick(d)}
                className={cn(winChrome, 'flex flex-col items-start gap-1 px-3 py-2.5 text-left')}
              >
                <div className='flex w-full items-center justify-between gap-2'>
                  <span className='text-sm font-bold'>{labels.difficulty[d]}</span>
                  <span className='text-[11px] text-muted'>
                    {labels.cleared}: {item.clearedCount}/{item.levelCount}
                  </span>
                </div>
                <p className='text-[11px] text-muted'>{labels.difficultyHint[d]}</p>
                <span className='text-[10px] text-muted'>
                  {labels.levels}: {item.levelCount}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
