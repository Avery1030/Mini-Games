'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useIdleTimeout } from '@/hooks/desktop'
import { useLockStore } from '@/store/lock'
import { screensaverIdleToMs, useSettingsStore } from '@/store/settings'
import { SCREENSAVER_BG, postFireworksEsc } from './screensaver-fx'

const ScreensaverCanvas = dynamic(
  () => import('./screensaver-fx').then((m) => m.ScreensaverCanvas),
  { ssr: false },
)

/**
 * 无操作超时全屏屏保；Esc 退出。锁屏时不启动。
 */
export function Screensaver() {
  const t = useTranslations('screensaver')
  const enabled = useSettingsStore((s) => s.screensaverEnabled)
  const idleMinutes = useSettingsStore((s) => s.screensaverIdleMinutes)
  const isLocked = useLockStore((s) => s.isLocked)

  const [idleActive, setIdleActive] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const active = idleActive && !isLocked

  const dismiss = useCallback(() => {
    setIdleActive(false)
  }, [])

  const activateIdle = useCallback(() => {
    if (isLocked) return
    setIdleActive(true)
  }, [isLocked])

  useIdleTimeout({
    enabled: enabled && !isLocked && !idleActive,
    timeoutMs: screensaverIdleToMs(idleMinutes),
    onIdle: activateIdle,
  })

  useEffect(() => {
    if (isLocked) setIdleActive(false)
  }, [isLocked])

  useEffect(() => {
    if (!active) return
    const el = rootRef.current
    el?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const iframe = canvasWrapRef.current?.querySelector('iframe')
      postFireworksEsc(iframe ?? null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active])

  useEffect(() => {
    if (!active) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'avery-fireworks-dismiss') dismiss()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [active, dismiss])

  if (!active) return null

  return (
    <div
      ref={rootRef}
      className='fixed inset-0 z-[9100] font-pixel select-none outline-none'
      style={{ backgroundColor: SCREENSAVER_BG }}
      role='dialog'
      aria-modal='true'
      aria-label={t('title')}
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={canvasWrapRef} className='absolute inset-0'>
        <ScreensaverCanvas />
      </div>
      <p className='pointer-events-none absolute inset-x-0 bottom-10 z-10 text-center text-[12px] text-white/55'>
        {t('dismissHint')}
      </p>
    </div>
  )
}
