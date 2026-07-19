'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'

export type BootScreenProps = {
  progress: number
  fading: boolean
  skipPending: boolean
  onSkip: () => void
}

/**
 * Win95 风格开机页：进度条 + 可跳过。
 */
export function BootScreen({ progress, fading, skipPending, onSkip }: BootScreenProps) {
  const t = useTranslations('boot')
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const blocks = 20
  const filled = Math.round((pct / 100) * blocks)

  const status = skipPending
    ? t('preparing')
    : pct >= 90
      ? t('ready')
      : pct >= 40
        ? t('loading')
        : t('starting')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black text-white font-pixel select-none',
        'transition-opacity duration-300',
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100',
      )}
      aria-busy='true'
      aria-live='polite'
      role='status'
    >
      <div className='flex flex-col items-center gap-8 px-6'>
        <div className='relative w-[120px] h-[120px]' aria-hidden>
          <div className='absolute inset-0 blur-xl opacity-40 bg-[radial-gradient(circle_at_40%_40%,#5b9bd5,transparent_55%),radial-gradient(circle_at_70%_60%,#f4a261,transparent_50%)]' />
          <div className='relative grid grid-cols-2 grid-rows-2 gap-1.5 w-full h-full p-2'>
            <span className='rounded-sm bg-[#ff3b3b] shadow-[2px_2px_0_#000]' />
            <span className='rounded-sm bg-[#3ddc84] shadow-[2px_2px_0_#000]' />
            <span className='rounded-sm bg-[#4fc3f7] shadow-[2px_2px_0_#000]' />
            <span className='rounded-sm bg-[#ffd54f] shadow-[2px_2px_0_#000]' />
          </div>
        </div>

        <div className='text-center space-y-2'>
          <h1 className='text-2xl sm:text-3xl font-bold tracking-wide text-[#f5f5f5]'>{t('title')}</h1>
          <p className='text-sm text-[#a8a8a8]'>{status}</p>
        </div>

        <div className='w-[min(320px,75vw)] space-y-2'>
          <div
            className='flex gap-0.5 h-5 p-0.5 border-2 border-[#808080] bg-[#000]'
            role='progressbar'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            {Array.from({ length: blocks }, (_, i) => (
              <div
                key={i}
                className={cn('flex-1 h-full', i < filled ? 'bg-[#c0c0c0]' : 'bg-transparent')}
              />
            ))}
          </div>
          <p className='text-center text-[11px] text-[#707070] tabular-nums'>{pct}%</p>
        </div>

        <button
          type='button'
          className={cn(
            'mt-2 px-4 py-1.5 text-sm border-2',
            'bg-[#c0c0c0] text-black',
            'border-t-white border-l-white border-r-[#808080] border-b-[#808080]',
            'hover:brightness-105 active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white',
          )}
          onClick={onSkip}
        >
          {t('skip')}
        </button>
      </div>

      <p className='absolute bottom-8 left-0 right-0 text-center text-[11px] text-[#555]'>{t('hint')}</p>
    </div>
  )
}
