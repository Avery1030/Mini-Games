'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { winChromeSunken } from '@/utils/winChrome'
import { cn } from '@/utils/cn'

function formatNow(format: '12h' | '24h', date: Date): string {
  if (format === '24h') {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** 任务栏托盘时钟 */
export function TaskbarClock() {
  const show = useSettingsStore((s) => s.showTaskbarClock)
  const format = useSettingsStore((s) => s.clockFormat)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!show) return
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [show])

  if (!show) return null

  return (
    <div
      className={cn(winChromeSunken, 'h-7 min-w-[64px] px-2 flex items-center justify-center text-[11px] tabular-nums')}
      title={now.toLocaleString()}
    >
      {formatNow(format, now)}
    </div>
  )
}
