'use client'

import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
] as const

export type UseIdleTimeoutOptions = {
  /** 空闲多久触发；≤0 或 enabled=false 时不监听 */
  timeoutMs: number
  enabled?: boolean
  onIdle: () => void
  /** 为空闲计时重置时调用（用户有操作） */
  onActive?: () => void
}

/**
 * 监听用户输入，超时后调用 onIdle；有活动时重置计时并可选调用 onActive。
 * 页面不可见时暂停计时。
 */
export function useIdleTimeout({
  timeoutMs,
  enabled = true,
  onIdle,
  onActive,
}: UseIdleTimeoutOptions) {
  const onIdleRef = useRef(onIdle)
  const onActiveRef = useRef(onActive)
  onIdleRef.current = onIdle
  onActiveRef.current = onActive

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return

    let timer: Nullable<number> = null

    const clear = () => {
      if (timer != null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const arm = () => {
      clear()
      if (document.visibilityState === 'hidden') return
      timer = window.setTimeout(() => {
        onIdleRef.current()
      }, timeoutMs)
    }

    const onActivity = () => {
      onActiveRef.current?.()
      arm()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clear()
      } else {
        arm()
      }
    }

    arm()
    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clear()
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, timeoutMs])
}
