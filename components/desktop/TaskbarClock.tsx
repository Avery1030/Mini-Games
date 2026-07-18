'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { enUS, zhCN } from 'react-day-picker/locale'
import { format } from 'date-fns'
import { enUS as enUSDateFns, zhCN as zhCNDateFns } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSettingsStore } from '@/store/settings'
import { Button } from '@/components/ui'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { cn } from '@/lib/cn'
import 'react-day-picker/style.css'

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
 * 任务栏时钟：点击弹出只读日历（react-day-picker）。
 */
export function TaskbarClock() {
  const t = useTranslations('clock')
  const locale = useLocale()
  const show = useSettingsStore((s) => s.showTaskbarClock)
  const clockFormat = useSettingsStore((s) => s.clockFormat)
  const [now, setNow] = useState<Date | null>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(() => new Date())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!show) {
      setNow(null)
      setOpen(false)
      return
    }
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [show])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointer)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!show) return null

  const today = now ?? new Date()
  const isChinese = locale === 'zh-CN'
  const calendarLocale = isChinese ? zhCN : enUS
  const dateLocale = isChinese ? zhCNDateFns : enUSDateFns

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        className={cn(
          open ? winChromePressed : winChromeSunken,
          'h-7 min-w-[64px] px-2 flex items-center justify-center text-[11px] tabular-nums font-pixel text-on-chrome',
          'cursor-pointer outline-none',
        )}
        title={now ? formatTitle(now) : undefined}
        aria-haspopup='dialog'
        aria-expanded={open}
        aria-label={t('openCalendar')}
        suppressHydrationWarning
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) setMonth(new Date())
            return next
          })
        }}
      >
        {now ? formatClock(clockFormat, now) : '--:--'}
      </button>

      {open && (
        <div
          role='dialog'
          aria-label={t('calendar')}
          className={cn(
            winChrome,
            'absolute bottom-full right-0 mb-1 z-[2000] p-2 shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
            'font-pixel hover:bg-chrome',
          )}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className='flex items-center justify-between gap-2 mb-1 px-0.5'>
            <Button
              size='icon-sm'
              aria-label={t('prevMonth')}
              onClick={() =>
                setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={14} />
            </Button>
            <div className='text-[12px] font-bold tabular-nums min-w-[7.5rem] text-center'>
              {t('monthTitle', {
                year: format(month, 'yyyy', { locale: dateLocale }),
                month: format(month, isChinese ? 'M' : 'MMMM', { locale: dateLocale }),
              })}
            </div>
            <Button
              size='icon-sm'
              aria-label={t('nextMonth')}
              onClick={() =>
                setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={14} />
            </Button>
          </div>

          <DayPicker
            mode='single'
            locale={calendarLocale}
            month={month}
            onMonthChange={setMonth}
            selected={today}
            today={today}
            showOutsideDays
            hideNavigation
            className='rdp-win95'
            classNames={{
              root: 'rdp-win95-root',
              months: 'flex flex-col',
              month: 'w-full',
              month_caption: 'hidden',
              month_grid: 'w-full border-collapse',
              weekdays: 'flex',
              weekday:
                'w-8 h-6 text-[10px] font-bold text-center text-on-chrome opacity-80',
              week: 'flex',
              day: 'w-8 h-8 p-0 text-[11px]',
              day_button:
                'w-8 h-8 m-0 p-0 text-[11px] border border-transparent bg-transparent text-on-chrome cursor-default',
              selected:
                '!bg-[var(--window-title-active)] !text-[var(--window-title-text)] border-[var(--window-title-active)]',
              today: 'font-bold underline decoration-accent',
              outside: 'opacity-40',
              disabled: 'opacity-30',
            }}
          />

          <div
            className={cn(
              winChromeSunken,
              'mt-1 px-2 py-1 text-[11px] tabular-nums bg-field text-on-chrome',
            )}
          >
            {t('today', {
              date: t('dateFull', {
                year: format(today, 'yyyy', { locale: dateLocale }),
                month: format(today, isChinese ? 'M' : 'MMMM', { locale: dateLocale }),
                day: format(today, 'd', { locale: dateLocale }),
                weekday: format(today, 'EEEE', { locale: dateLocale }),
              }),
            })}
          </div>
        </div>
      )}
    </div>
  )
}
