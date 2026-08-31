'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'
import { formatTime } from './anim'
import { useSpiderStore } from './store'
import { DIFFICULTIES, TOP_RECORDS, isDifficulty, type Difficulty, type SpiderTimeRecord } from './types'

type RecordsTableProps = {
  records: SpiderTimeRecord[]
  highlightAt?: number
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn(winChromeSunken, 'flex min-w-0 flex-1 flex-col gap-0.5 bg-field px-2 py-1.5')}>
      <span className='text-[10px] leading-none text-muted'>{label}</span>
      <span className='truncate text-[13px] font-bold tabular-nums leading-tight'>{value}</span>
    </div>
  )
}

function RecordsTable({ records, highlightAt }: RecordsTableProps) {
  const t = useTranslations('spider')
  const slots: Array<Nullable<SpiderTimeRecord>> = Array.from({ length: TOP_RECORDS }, (_, i) => records[i] ?? null)

  return (
    <div className={cn(winChromeSunken, 'overflow-hidden bg-field')}>
      <table className='w-full table-fixed border-collapse text-[12px]'>
        <colgroup>
          <col className='w-[18%]' />
          <col className='w-[28%]' />
          <col className='w-[27%]' />
          <col className='w-[27%]' />
        </colgroup>
        <thead>
          <tr className='border-b border-chrome-dark bg-chrome text-muted'>
            <th className='px-2 py-1.5 text-center font-normal'>{t('recordsRank')}</th>
            <th className='px-2 py-1.5 text-right font-normal'>{t('recordsTime')}</th>
            <th className='px-2 py-1.5 text-right font-normal'>{t('recordsMoves')}</th>
            <th className='px-2 py-1.5 text-right font-normal'>{t('recordsScore')}</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((row, i) => {
            const rank = i + 1
            const active = row != null && highlightAt != null && row.at === highlightAt
            return (
              <tr
                key={row?.at ?? `empty-${rank}`}
                className={cn(
                  'tabular-nums',
                  active && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                )}
              >
                <td className='px-2 py-1.5 text-center'>{rank}</td>
                <td className={cn('px-2 py-1.5 text-right', !row && 'text-muted')}>
                  {row ? formatTime(row.elapsed) : '—'}
                </td>
                <td className={cn('px-2 py-1.5 text-right', !row && 'text-muted')}>{row ? row.moves : '—'}</td>
                <td className={cn('px-2 py-1.5 text-right', !row && 'text-muted')}>{row ? row.score : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function WinRecordsBody({
  elapsed,
  moves,
  score,
  rank,
  records,
  highlightAt,
}: {
  elapsed: number
  moves: number
  score: number
  /** undefined：重开已入榜对局，不展示新纪录/未入榜提示 */
  rank?: Nullable<number>
  records: SpiderTimeRecord[]
  highlightAt?: number
}) {
  const t = useTranslations('spider')
  return (
    <div className='flex flex-col gap-2.5 whitespace-normal'>
      <div className='flex gap-1.5'>
        <StatCell label={t('recordsTime')} value={formatTime(elapsed)} />
        <StatCell label={t('recordsMoves')} value={String(moves)} />
        <StatCell label={t('recordsScore')} value={String(score)} />
      </div>
      {rank !== undefined &&
        (rank != null ? (
          <p className='text-[12px] font-bold text-[var(--window-title-active)]'>{t('newRecord', { rank })}</p>
        ) : (
          <p className='text-[12px] text-muted'>{t('recordsMissed')}</p>
        ))}
      <div className='flex flex-col gap-1'>
        <p className='text-[11px] text-muted'>{t('recordsBoard')}</p>
        <RecordsTable records={records} highlightAt={highlightAt} />
      </div>
    </div>
  )
}

/** 工具栏打开的历史榜：可切换难度查看 */
export function RecordsModalBody({ initialDifficulty }: { initialDifficulty: Difficulty }) {
  const t = useTranslations('spider')
  const recordsMap = useSpiderStore((s) => s.records)
  const [view, setView] = useState<Difficulty>(initialDifficulty)
  const list = recordsMap[view] ?? []

  return (
    <div className='flex flex-col gap-2.5 whitespace-normal'>
      <Select
        size='sm'
        className='w-full'
        aria-label={t('difficulty')}
        value={String(view)}
        options={DIFFICULTIES.map((d) => ({ value: String(d), label: t(`diff${d}`) }))}
        onValueChange={(v) => {
          const next = Number(v)
          if (isDifficulty(next)) setView(next)
        }}
      />
      <RecordsTable records={list} />
    </div>
  )
}
