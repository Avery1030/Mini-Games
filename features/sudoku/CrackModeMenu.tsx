import { cn } from '@/lib/cn'
import { winChromePanel } from '@/lib/winChrome'
import type { CrackMode } from './types'
import { MenuActionBtn } from './uiParts'

type Props = {
  title: string
  instantLabel: string
  manualLabel: string
  closeLabel: string
  onPick: (mode: CrackMode) => void
  onClose: () => void
}

export function CrackModeMenu({ title, instantLabel, manualLabel, closeLabel, onPick, onClose }: Props) {
  return (
    <div
      className='absolute inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 dark:bg-black/60'
      onClick={onClose}
    >
      <div
        className={cn(winChromePanel, 'w-full max-w-[300px] bg-chrome text-on-chrome')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='px-3 py-2 border-b border-chrome-dark'>
          <p className='text-sm font-bold text-center'>{title}</p>
        </div>
        <div className='flex flex-col p-2 gap-1'>
          <MenuActionBtn label={instantLabel} onClick={() => onPick('instant')} />
          <MenuActionBtn label={manualLabel} onClick={() => onPick('manual')} />
          <MenuActionBtn label={closeLabel} onClick={onClose} muted />
        </div>
      </div>
    </div>
  )
}
