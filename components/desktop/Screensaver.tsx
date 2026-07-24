'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useIdleTimeout } from '@/hooks/desktop'
import { useLockStore } from '@/store/lock'
import { useSettingsStore } from '@/store/settings'

/** 屏保纯色背景（后续可换成动画/壁纸） */
const SCREENSAVER_BG = '#0a0a12'
/** 启动后忽略输入的宽限，避免叠层出现时残留 pointer 事件立刻退出 */
const DISMISS_GRACE_MS = 400

/**
 * 无操作超时后的全屏屏保；任意指针/键盘操作退出。
 * 锁屏时不启动；启用状态与超时时间来自 settings store。
 */
export function Screensaver() {
  const t = useTranslations('screensaver')
  const enabled = useSettingsStore((s) => s.screensaverEnabled)
  const idleMinutes = useSettingsStore((s) => s.screensaverIdleMinutes)
  const isLocked = useLockStore((s) => s.isLocked)

  const [active, setActive] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const armedAtRef = useRef(0)

  const dismiss = useCallback(() => {
    if (performance.now() - armedAtRef.current < DISMISS_GRACE_MS) return
    setActive(false)
  }, [])

  const activate = useCallback(() => {
    if (isLocked) return
    armedAtRef.current = performance.now()
    setActive(true)
  }, [isLocked])

  useIdleTimeout({
    enabled: enabled && !isLocked && !active,
    timeoutMs: idleMinutes * 60_000,
    onIdle: activate,
  })

  useEffect(() => {
    if (isLocked) setActive(false)
  }, [isLocked])

  useEffect(() => {
    if (!active) return
    const el = rootRef.current
    el?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dismiss()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, dismiss])

  if (!active || isLocked) return null

  return (
    <div
      ref={rootRef}
      className='fixed inset-0 z-[9100] flex items-end justify-center pb-10 font-pixel select-none outline-none'
      style={{ backgroundColor: SCREENSAVER_BG }}
      role='dialog'
      aria-modal='true'
      aria-label={t('title')}
      tabIndex={-1}
      onPointerDown={dismiss}
      onPointerMove={dismiss}
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className='text-[12px] text-white/40'>{t('dismissHint')}</p>
    </div>
  )
}
