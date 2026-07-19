'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/store/settings'
import { closeModal, useModalStore } from '@/components/ui'
import { winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { cn } from '@/lib/cn'
import { CALENDAR_MODAL_ID, openCalendarModal } from './CalendarModal'

function formatClock(formatMode: '12h' | '24h', date: Date): string {
  if (formatMode === '24h') {
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

function formatTitle(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * 任务栏时钟：点击打开居中日历弹窗。
 */
export function TaskbarClock() {
  const t = useTranslations('clock')
  const { show: showClock, clockFormat } = useSettingsStore(
    useShallow((s) => ({
      show: s.showTaskbarClock,
      clockFormat: s.clockFormat,
    })),
  )
  const calendarOpen = useModalStore((s) => s.stack.some((m) => m.id === CALENDAR_MODAL_ID))
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    if (!showClock) {
      setNow(null)
      if (useModalStore.getState().stack.some((m) => m.id === CALENDAR_MODAL_ID)) {
        closeModal(CALENDAR_MODAL_ID)
      }
      return
    }
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [showClock])

  if (!showClock) return null

  return (
    <button
      type='button'
      className={cn(
        calendarOpen ? winChromePressed : winChromeSunken,
        'h-7 min-w-[64px] px-2 flex items-center justify-center text-[11px] tabular-nums font-pixel text-on-chrome',
        'cursor-pointer outline-none',
      )}
      title={now ? formatTitle(now) : undefined}
      aria-haspopup='dialog'
      aria-expanded={calendarOpen}
      aria-label={t('openCalendar')}
      suppressHydrationWarning
      onClick={() => {
        if (calendarOpen) {
          closeModal(CALENDAR_MODAL_ID)
          return
        }
        openCalendarModal(t('calendar'))
      }}
    >
      {now ? formatClock(clockFormat, now) : '--:--'}
    </button>
  )
}
