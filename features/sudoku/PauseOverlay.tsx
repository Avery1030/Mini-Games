import { cn } from '@/lib/cn'
import { winChrome } from '@/lib/winChrome'

type Props = {
  pausedLabel: string
  resumeLabel: string
  onResume: () => void
}

export function PauseOverlay({ pausedLabel, resumeLabel, onResume }: Props) {
  return (
    <div className='absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/50 dark:bg-black/60'>
      <p className='text-white text-base font-semibold'>{pausedLabel}</p>
      <button type='button' onClick={onResume} className={cn(winChrome, 'px-4 py-1.5 text-sm font-semibold')}>
        {resumeLabel}
      </button>
    </div>
  )
}
