'use client'

import { winChromeSunken } from '@/lib/winChrome'
import { cn } from '@/lib/cn'

const MARKS = 17

/** WordPad 式水平标尺（刻度展示，不改窗口拖拽） */
export function WriterRuler() {
  return (
    <div className={cn(winChromeSunken, 'h-5 mx-0 bg-field relative overflow-hidden shrink-0')}>
      <div className='h-full flex'>
        {Array.from({ length: MARKS }, (_, i) => (
          <div key={i} className='relative flex-1 min-w-0 border-l border-chrome-dark/80'>
            <span className='absolute left-0.5 top-0 text-[8px] leading-none text-muted tabular-nums'>{i}</span>
            <span className='absolute left-1/4 bottom-0 w-px h-1.5 bg-chrome-dark/70' />
            <span className='absolute left-1/2 bottom-0 w-px h-2.5 bg-chrome-dark' />
            <span className='absolute left-3/4 bottom-0 w-px h-1.5 bg-chrome-dark/70' />
          </div>
        ))}
      </div>
    </div>
  )
}
