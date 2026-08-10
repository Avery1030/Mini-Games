'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, isSameDay, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button, openModal } from '@/components/ui'
import { useSettingsStore } from '@/store/settings'
import { dateKeyFromDate, useCalendarStore } from '@/store/calendar'
import { cn } from '@/lib/cn'
import { dateFnsLocale, dayPickerLocale, intlLocale } from '@/lib/i18n/dateLocales'
import 'react-day-picker/style.css'

export const CALENDAR_MODAL_ID = 'taskbar-calendar'

function formatLiveClock(formatMode: '12h' | '24h', date: Date, locale: string): string {
  const tag = intlLocale(locale)
  if (formatMode === '24h') {
    return date.toLocaleTimeString(tag, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }
  return date.toLocaleTimeString(tag, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
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

  const notedDates = useMemo(
    () => Object.keys(notes).map((k) => startOfDay(new Date(`${k}T12:00:00`))),
    [notes],
  )

  const dirty = draft.trim() !== savedNote.trim()

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

  return (
    <div className='font-pixel space-y-2' onContextMenu={(e) => e.preventDefault()}>
      <div
        className='px-2 py-1.5 text-center text-[13px] font-bold tabular-nums bg-field text-on-chrome border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light'
        aria-label={t('liveTime')}
      >
        {formatLiveClock(clockFormat, now, locale)}
      </div>

      <div className='flex items-center gap-1.5'>
        <Button
          size='icon-sm'
          aria-label={t('prevMonth')}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
        >
          <ChevronLeft size={14} />
        </Button>
        <div className='flex-1 text-[12px] font-bold tabular-nums text-center min-w-0 truncate'>
          {t('monthTitle', {
            year: format(month, 'yyyy', { locale: dateLocale }),
            month: format(month, isChinese ? 'M' : 'MMMM', { locale: dateLocale }),
          })}
        </div>
        <Button
          size='icon-sm'
          aria-label={t('nextMonth')}
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
        >
          <ChevronRight size={14} />
        </Button>
        <Button size='sm' className='shrink-0 px-2' onClick={goToday}>
          {t('todayBtn')}
        </Button>
      </div>

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
        modifiers={{ noted: notedDates }}
        className='rdp-win95'
        classNames={{
          root: 'rdp-win95-root',
          months: 'flex flex-col',
          month: 'w-full',
          month_caption: 'hidden',
          month_grid: 'w-full border-collapse',
          weekdays: 'flex',
          weekday: 'w-8 h-6 text-[10px] font-bold text-center text-on-chrome opacity-80',
          week: 'flex',
          day: 'w-8 h-8 p-0 text-[11px]',
          day_button:
            'relative w-8 h-8 m-0 p-0 text-[11px] border border-transparent bg-transparent text-on-chrome cursor-pointer',
          selected: cn(
            '!bg-[var(--window-title-active)]',
            '[&_button]:!bg-[var(--window-title-active)]',
            '[&_button]:!text-[var(--window-title-text)]',
            '[&_button]:!border-[var(--window-title-active)]',
            '[&_button]:font-bold',
          ),
          today: cn(
            '[&_button]:font-bold',
            '[&_button]:underline',
            '[&_button]:decoration-2',
            '[&_button]:decoration-accent',
            '[&_button]:underline-offset-2',
          ),
          outside: 'opacity-40',
          disabled: 'opacity-30',
        }}
        modifiersClassNames={{
          noted: 'rdp-day-noted',
        }}
      />

      <div className='px-2 py-1.5 text-[11px] tabular-nums bg-field text-on-chrome border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light'>
        {t('selected', { date: dateFull })}
        {isSameDay(selected, now) ? ` · ${t('isToday')}` : ''}
      </div>

      <div className='space-y-1.5'>
        <label className='block text-[11px] font-bold' htmlFor='calendar-day-note'>
          {t('note')}
        </label>
        <textarea
          id='calendar-day-note'
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 500))}
          onBlur={saveDraft}
          placeholder={t('notePlaceholder')}
          rows={3}
          className={cn(
            'w-full resize-none px-2 py-1.5 text-[11px] font-pixel text-on-chrome bg-field outline-none',
            'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          )}
        />
        <div className='flex justify-end'>
          <Button size='sm' className='px-3' disabled={!dirty} onClick={saveDraft}>
            {t('save')}
          </Button>
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
    widthClassName: 'w-[min(340px,calc(100vw-2rem))]',
    content: <CalendarModalContent />,
  })
}
