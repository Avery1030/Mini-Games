'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, isSameDay, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button, openModal, Select, type SelectOption } from '@/components/ui'
import { useSettingsStore } from '@/store/settings'
import { dateKeyFromDate, useCalendarStore } from '@/store/calendar'
import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'
import { dateFnsLocale, dayPickerLocale, intlLocale } from '@/lib/i18n/dateLocales'

export const CALENDAR_MODAL_ID = 'taskbar-calendar'

const NOTE_MAX = 500

function buildYearOptions(centerYear: number): SelectOption[] {
  const nowYear = new Date().getFullYear()
  const min = Math.min(centerYear - 50, nowYear - 100)
  const max = Math.max(centerYear + 50, nowYear + 20)
  const out: SelectOption[] = []
  for (let y = min; y <= max; y++) out.push({ value: String(y), label: String(y) })
  return out
}

function buildMonthOptions(locale: string, dateLocale: ReturnType<typeof dateFnsLocale>): SelectOption[] {
  const eastAsian = locale === 'zh-CN' || locale === 'ja-JP'
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2000, i, 1)
    const label = eastAsian ? `${format(d, 'M', { locale: dateLocale })}月` : format(d, 'MMMM', { locale: dateLocale })
    return { value: String(i), label }
  })
}

function formatLedParts(formatMode: '12h' | '24h', date: Date, locale: string) {
  const tag = intlLocale(locale)
  const parts = new Intl.DateTimeFormat(tag, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: formatMode === '12h',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const pad = (value: string) => value.padStart(2, '0')
  return {
    time: `${pad(get('hour'))}:${get('minute')}:${get('second')}`,
    period: get('dayPeriod'),
  }
}

/** 日历弹窗主体：选日、今天、实时钟、按日备注 */
export function CalendarModalContent() {
  const t = useTranslations('clock')
  const locale = useLocale()
  const clockFormat = useSettingsStore((s) => s.clockFormat)
  const notes = useCalendarStore((s) => s.notes)
  const setNote = useCalendarStore((s) => s.setNote)

  const [now, setNow] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const selectedKey = dateKeyFromDate(selected)
  const savedNote = notes[selectedKey] ?? ''
  const [draft, setDraft] = useState(savedNote)
  const draftRef = useRef(draft)
  const selectedKeyRef = useRef(selectedKey)
  draftRef.current = draft
  selectedKeyRef.current = selectedKey

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    setDraft(notes[selectedKey] ?? '')
  }, [selectedKey, notes])

  const isChinese = locale === 'zh-CN'
  const calendarLocale = dayPickerLocale(locale)
  const dateLocale = dateFnsLocale(locale)

  const notedDates = useMemo(() => Object.keys(notes).map((k) => startOfDay(new Date(`${k}T12:00:00`))), [notes])

  const yearOptions = useMemo(() => buildYearOptions(month.getFullYear()), [month])
  const monthOptions = useMemo(() => buildMonthOptions(locale, dateLocale), [locale, dateLocale])

  const dirty = draft.trim() !== savedNote.trim()
  const selectedIsToday = isSameDay(selected, now)
  const led = formatLedParts(clockFormat, now, locale)

  const persistDraftFor = (dateKey: string, text: string) => {
    setNote(dateKey, text)
  }

  const goToday = () => {
    persistDraftFor(selectedKeyRef.current, draftRef.current)
    const today = startOfDay(new Date())
    setSelected(today)
    setMonth(today)
  }

  const saveDraft = () => {
    persistDraftFor(selectedKey, draft)
  }

  const selectDay = (d: Date) => {
    const day = startOfDay(d)
    const nextKey = dateKeyFromDate(day)
    if (nextKey !== selectedKeyRef.current) {
      persistDraftFor(selectedKeyRef.current, draftRef.current)
    }
    setSelected(day)
    setMonth(day)
  }

  const dateFull = t('dateFull', {
    year: format(selected, 'yyyy', { locale: dateLocale }),
    month: format(selected, isChinese ? 'M' : 'MMMM', { locale: dateLocale }),
    day: format(selected, 'd', { locale: dateLocale }),
    weekday: format(selected, 'EEEE', { locale: dateLocale }),
  })

  const nowWeekday = format(now, 'EEEE', { locale: dateLocale })
  const nowDateShort =
    locale === 'zh-CN' || locale === 'ja-JP'
      ? format(now, 'yyyy年M月d日', { locale: dateLocale })
      : format(now, 'MMM d, yyyy', { locale: dateLocale })

  return (
    <div className='font-pixel w-full min-w-0 space-y-2.5' onContextMenu={(e) => e.preventDefault()}>
      <div
        className={cn(
          winChromeSunken,
          'flex min-w-0 items-center justify-between gap-3 px-3 py-2.5',
          'bg-[#07101f] text-accent dark:bg-[#050a14]',
          '[text-shadow:0_0_10px_color-mix(in_srgb,var(--accent)_50%,transparent)]',
          'shadow-[inset_2px_2px_0_rgba(0,0,0,0.55),inset_-1px_-1px_0_rgba(255,255,255,0.08)]',
        )}
        aria-label={t('liveTime')}
      >
        <div className='flex min-w-0 items-end gap-1.5'>
          <span className="font-['Seven_Segmentiments',ui-monospace,monospace] text-[1.55rem] leading-none tracking-[0.08em] tabular-nums">
            {led.time}
          </span>
          {led.period ? (
            <span className='mb-0.5 shrink-0 text-[10px] font-bold leading-none opacity-80'>{led.period}</span>
          ) : null}
        </div>
        <div className='shrink-0 text-right leading-tight'>
          <div className='text-[11px] font-bold tracking-wide'>{nowWeekday}</div>
          <div className='mt-0.5 text-[10px] opacity-80'>{nowDateShort}</div>
        </div>
      </div>

      <div className='flex items-center gap-1'>
        <Button
          size='icon-sm'
          aria-label={t('prevMonth')}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          <ChevronLeft size={14} />
        </Button>
        <Select
          size='sm'
          className='flex-1 min-w-0'
          aria-label={t('pickYear')}
          options={yearOptions}
          value={String(month.getFullYear())}
          menuClassName='max-h-40'
          onValueChange={(v) => setMonth((m) => new Date(Number(v), m.getMonth(), 1))}
        />
        <Select
          size='sm'
          className='flex-1 min-w-0'
          aria-label={t('pickMonth')}
          options={monthOptions}
          value={String(month.getMonth())}
          menuClassName='max-h-40'
          onValueChange={(v) => setMonth((m) => new Date(m.getFullYear(), Number(v), 1))}
        />
        <Button
          size='icon-sm'
          aria-label={t('nextMonth')}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          <ChevronRight size={14} />
        </Button>
        <Button size='sm' className='shrink-0 px-2 font-bold' onClick={goToday}>
          {t('todayBtn')}
        </Button>
      </div>

      <div className={cn(winChromeSunken, 'w-full min-w-0 bg-field p-1.5')}>
        <DayPicker
          mode='single'
          locale={calendarLocale}
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          today={now}
          onSelect={(d) => {
            if (!d) return
            selectDay(d)
          }}
          showOutsideDays
          hideNavigation
          modifiers={{
            noted: notedDates,
            weekend: { dayOfWeek: [0, 6] },
          }}
          className='w-full min-w-0'
          classNames={{
            root: 'relative box-border w-full min-w-0 text-on-chrome',
            months: 'relative flex w-full max-w-none',
            month: 'w-full',
            month_caption: 'hidden',
            month_grid: 'w-full border-collapse table-fixed',
            weekday:
              'h-[1.65rem] w-[calc(100%/7)] px-0 py-1 text-center align-middle text-[10px] font-bold tracking-wide text-muted',
            day: 'h-[2.15rem] w-[calc(100%/7)] p-px text-center align-middle',
            day_button: cn(
              'relative m-0 flex h-full w-full cursor-pointer appearance-none items-center justify-center rounded-none',
              'border border-transparent bg-transparent p-0 text-[11px] font-semibold leading-none text-on-chrome',
              'hover:bg-[color-mix(in_srgb,var(--window-title-active)_16%,transparent)]',
            ),
            selected: cn(
              '[&_button]:border-[var(--window-title-active)] [&_button]:bg-[var(--window-title-active)]',
              '[&_button]:font-extrabold [&_button]:text-[var(--window-title-text)] [&_button]:shadow-none',
              '[&_button]:hover:bg-[var(--window-title-active)] [&_button]:hover:brightness-110',
            ),
            today:
              '[&:not([data-selected])_button]:font-extrabold [&:not([data-selected])_button]:shadow-[inset_0_0_0_2px_var(--window-title-active)]',
            focused: cn(
              '[&:not([data-selected])_button]:outline [&:not([data-selected])_button]:outline-1',
              '[&:not([data-selected])_button]:outline-dotted [&:not([data-selected])_button]:outline-[var(--text-on-chrome)]',
              '[&:not([data-selected])_button]:outline-offset-[-3px]',
            ),
            outside: 'opacity-[0.38]',
            disabled: 'opacity-30',
            hidden: 'invisible',
          }}
          modifiersClassNames={{
            noted: cn(
              '[&_button]:after:pointer-events-none [&_button]:after:absolute [&_button]:after:bottom-[3px] [&_button]:after:left-1/2',
              '[&_button]:after:h-1 [&_button]:after:w-1 [&_button]:after:-translate-x-1/2 [&_button]:after:rounded-full',
              '[&_button]:after:bg-accent [&_button]:after:content-[""]',
              '[&_button]:after:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-border)_55%,transparent)]',
              '[&[data-selected]_button]:after:bg-[var(--window-title-text)] [&[data-selected]_button]:after:shadow-none',
            ),
            weekend:
              '[&:not([data-selected])_button]:text-[#b4232c] dark:[&:not([data-selected])_button]:text-[#f0a0a6]',
          }}
        />
      </div>

      <div
        className={cn(
          winChromeSunken,
          'flex items-center gap-2 bg-status-bar px-2 py-1.5 text-[11px] leading-snug text-status-bar-fg',
        )}
      >
        <span className='min-w-0 flex-1 truncate tabular-nums text-on-chrome'>{t('selected', { date: dateFull })}</span>
        {selectedIsToday ? (
          <span className='shrink-0 border border-accent-border bg-accent px-1 py-px text-[10px] font-bold leading-none text-on-chrome'>
            {t('isToday')}
          </span>
        ) : null}
      </div>

      <div className='relative pt-1.5'>
        <label
          htmlFor='calendar-day-note'
          className='absolute -top-0.5 left-2 z-[1] bg-chrome px-1 text-[11px] font-bold'
        >
          {t('note')}
        </label>
        <div className={cn(winChromeSunken, 'space-y-1.5 p-2 pt-3')}>
          <textarea
            id='calendar-day-note'
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX))}
            onBlur={saveDraft}
            placeholder={t('notePlaceholder')}
            rows={3}
            className={cn(
              'w-full resize-none px-2 py-1.5 text-[11px] font-pixel text-on-chrome bg-field outline-none',
              winChromeSunken,
            )}
          />
          <div className='flex items-center justify-between gap-2'>
            <span className='tabular-nums text-[10px] text-muted'>
              {draft.length}/{NOTE_MAX}
            </span>
            <Button size='sm' className='px-3' disabled={!dirty} onClick={saveDraft}>
              {t('save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function openCalendarModal(title: string) {
  openModal({
    id: CALENDAR_MODAL_ID,
    title,
    dismissible: true,
    showClose: true,
    widthClassName: 'w-[min(372px,calc(100vw-2rem))]',
    content: <CalendarModalContent />,
  })
}
