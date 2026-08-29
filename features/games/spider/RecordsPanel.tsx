'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime } from './anim'
import { useSpiderStore } from './store'
import { DIFFICULTIES, type Difficulty, type SpiderTimeRecord } from './types'

type RecordsTableProps = {
  records: SpiderTimeRecord[]
  highlightAt?: number
}

function RecordsTable({ records, highlightAt }: RecordsTableProps) {
  const t = useTranslations('spider')

  if (records.length === 0) {
    return <p className='py-2 text-center text-[12px] text-muted'>{t('recordsEmpty')}</p>
  }

  return (
    <table className='w-full border-collapse text-left text-[12px]'>
      <thead>
        <tr className='border-b border-chrome-dark text-muted'>
          <th className='py-1 pr-2 font-normal'>{t('recordsRank')}</th>
          <th className='py-1 pr-2 font-normal'>{t('recordsTime')}</th>
          <th className='py-1 pr-2 font-normal'>{t('recordsMoves')}</th>
          <th className='py-1 font-normal'>{t('recordsScore')}</th>
        </tr>
      </thead>
      <tbody>
        {records.map((row, i) => {
          const rank = i + 1
          const active = highlightAt != null && row.at === highlightAt
          return (
            <tr
              key={row.at}
              className={cn(
                'border-b border-chrome-dark/50 tabular-nums',
                active && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
              )}
            >
              <td className='py-1 pr-2 font-bold'>{rank}</td>
              <td className='py-1 pr-2'>{formatTime(row.elapsed)}</td>
              <td className='py-1 pr-2'>{row.moves}</td>
              <td className='py-1'>{row.score}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function WinRecordsBody({
  hint,
  rank,
  records,
  highlightAt,
}: {
  hint: ReactNode
  /** undefined：重开已入榜对局，不展示新纪录/未入榜提示 */
  rank?: number | null
  records: SpiderTimeRecord[]
  highlightAt?: number
}) {
  const t = useTranslations('spider')
  return (
    <div className='space-y-2'>
      <p>{hint}</p>
      {rank !== undefined &&
        (rank != null ? (
          <p className='text-[12px] font-bold text-green-800 dark:text-green-400'>
            {t('newRecord', { rank })}
          </p>
        ) : (
          <p className='text-[12px] text-muted'>{t('recordsMissed')}</p>
        ))}
      <p className='text-[11px] font-bold'>{t('recordsBoard')}</p>
      <RecordsTable records={records} highlightAt={highlightAt} />
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
    <div className='space-y-2'>
      <Select
        size='sm'
        className='w-full'
        aria-label={t('difficulty')}
        value={String(view)}
        options={DIFFICULTIES.map((d) => ({ value: String(d), label: t(`diff${d}`) }))}
        onValueChange={(v) => setView(Number(v) as Difficulty)}
      />
      <RecordsTable records={list} />
    </div>
  )
}
