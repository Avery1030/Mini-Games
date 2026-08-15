'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { WindowsDesktop } from './WindowsDesktop'
import { MobileDesktop } from './mobile'
import { BootScreen } from './BootScreen'
import { LockScreen } from './LockScreen'
import { Screensaver } from './Screensaver'
import { DesktopDocumentTitle, useApplyUiScale, useIsMobileViewport, useWindowRouteSync } from '@/hooks/desktop'
import { useDesktopStore } from '@/store/desktop'
import { useWindowStore } from '@/store/window'
import { useSettingsStore } from '@/store/settings'
import { useLockStore } from '@/store/lock'
import { scheduleIdlePrefetchBuiltinApps } from '@/lib/desktop/window'

/** 临时关闭开机动画；改回 true 即可恢复 */
const BOOT_ANIMATION_ENABLED = true

/** 匀速开机总时长 */
const BOOT_DURATION_MS = 3_000
const BOOT_FADE_MS = 320

/**
 * 客户端壳：先显示开机页，待 persist 水合完成后再挂载桌面，
 * 避免 SSR / 本地状态不一致导致的水合报错与闪烁。
 * 窄屏（&lt;768px）渲染 MobileDesktop，宽屏渲染 WindowsDesktop。
 */
export function DesktopShell() {
  const windowsHydrated = useWindowStore((s) => s._hasHydrated)
  const desktopHydrated = useDesktopStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const lockHydrated = useLockStore((s) => s._hasHydrated)
  const storesReady = windowsHydrated && desktopHydrated && settingsHydrated && lockHydrated

  const [booting, setBooting] = useState(BOOT_ANIMATION_ENABLED)
  const [fading, setFading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [skipPending, setSkipPending] = useState(false)

  useApplyUiScale()
  useWindowRouteSync(!booting && storesReady)
  const isMobile = useIsMobileViewport()

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
    if (storesReadyRef.current) finish()
  }, [finish])

  useEffect(() => {
    if (!BOOT_ANIMATION_ENABLED) return
    if (storesReady && skipRef.current) finish()
  }, [storesReady, finish])

  useEffect(() => {
    if (!BOOT_ANIMATION_ENABLED) return

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
          setSkipPending(true)
        }
        return
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [finish])

  useEffect(() => {
    if (!BOOT_ANIMATION_ENABLED) return
    if (storesReady && progress >= 100 && !finishedRef.current) finish()
  }, [storesReady, progress, finish])

  const showDesktop = BOOT_ANIMATION_ENABLED ? !booting : storesReady

  // 桌面出现后空闲预热应用 chunk，缩短首次打开等待
  useEffect(() => {
    if (!showDesktop) return
    return scheduleIdlePrefetchBuiltinApps()
  }, [showDesktop])

  return (
    <>
      <DesktopDocumentTitle />
      {showDesktop && (
        <>
          {isMobile ? <MobileDesktop /> : <WindowsDesktop />}
          <LockScreen />
          <Screensaver />
        </>
      )}
      {BOOT_ANIMATION_ENABLED && booting && (
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
