'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { WindowsDesktop } from './WindowsDesktop'
import { useApplyUiScale } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'

/** 匀速开机总时长 */
const BOOT_DURATION_MS = 20_000
const BOOT_FADE_MS = 320

/**
 * 客户端壳：先显示开机页，待 persist 水合完成后再挂载桌面，
 * 避免 SSR / 本地状态不一致导致的水合报错与闪烁。
 */
export function DesktopShell() {
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const desktopHydrated = useDesktopStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const storesReady = windowsHydrated && desktopHydrated && settingsHydrated

  useApplyUiScale()

  const [booting, setBooting] = useState(true)
  const [fading, setFading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [skipPending, setSkipPending] = useState(false)

  const finishedRef = useRef(false)
  const storesReadyRef = useRef(storesReady)
  const skipRef = useRef(false)

  storesReadyRef.current = storesReady

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    setProgress(100)
    setFading(true)
    window.setTimeout(() => setBooting(false), BOOT_FADE_MS)
  }, [])

  const requestSkip = useCallback(() => {
    if (finishedRef.current) return
    skipRef.current = true
    setSkipPending(true)
    setProgress(100)
    // 水合已完成则可立刻进入；否则等水合后再进，避免桌面闪错
    if (storesReadyRef.current) finish()
  }, [finish])

  useEffect(() => {
    if (storesReady && skipRef.current) finish()
  }, [storesReady, finish])

  useEffect(() => {
    const startedAt = performance.now()
    let raf = 0

    const tick = () => {
      if (finishedRef.current) return

      if (skipRef.current) {
        setProgress(100)
        if (storesReadyRef.current) finish()
        return
      }

      const elapsed = performance.now() - startedAt
      const next = Math.min(100, (elapsed / BOOT_DURATION_MS) * 100)
      setProgress(next)

      if (next >= 100) {
        if (storesReadyRef.current) {
          finish()
        } else {
          // 进度已满，等 persist 水合后进入
          setSkipPending(true)
        }
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [finish])

  // 进度跑满且水合完成后自动进入
  useEffect(() => {
    if (storesReady && progress >= 100 && !finishedRef.current) finish()
  }, [storesReady, progress, finish])

  return (
    <>
      {!booting && <WindowsDesktop />}
      {booting && (
        <BootScreen
          progress={progress}
          fading={fading}
          skipPending={skipPending && !storesReady}
          onSkip={requestSkip}
        />
      )}
    </>
  )
}

function BootScreen({
  progress,
  fading,
  skipPending,
  onSkip,
}: {
  progress: number
  fading: boolean
  skipPending: boolean
  onSkip: () => void
}) {
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
