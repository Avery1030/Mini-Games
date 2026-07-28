'use client'

import { useEffect, useState } from 'react'
import { Battery, Signal, Wifi } from 'lucide-react'
import { useSettingsStore } from '@/store/settings'

function formatTime(formatMode: '12h' | '24h', date: Date): string {
  if (formatMode === '24h') {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** 手机状态栏：时间 + 装饰性信号/电量 */
export function MobileStatusBar() {
  const clockFormat = useSettingsStore((s) => s.clockFormat)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div
      className='flex shrink-0 items-center justify-between px-4 text-[13px] font-semibold text-white tabular-nums'
      style={{
        paddingTop: 'max(0.35rem, env(safe-area-inset-top))',
        textShadow: '0 1px 2px rgba(0,0,0,0.45)',
      }}
    >
      <span className='min-w-[3.5rem]'>{now ? formatTime(clockFormat, now) : '--:--'}</span>
      <div className='flex items-center gap-1.5 opacity-95'>
        <Signal className='size-3.5' strokeWidth={2.25} aria-hidden />
        <Wifi className='size-3.5' strokeWidth={2.25} aria-hidden />
        <Battery className='size-3.5' strokeWidth={2.25} aria-hidden />
      </div>
    </div>
  )
}
