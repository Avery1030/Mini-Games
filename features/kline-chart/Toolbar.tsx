'use client'

import { useTranslations } from 'next-intl'
import { Button, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  INTERVALS,
  OVERLAY_INDICATORS,
  PANE_INDICATORS,
  SYMBOLS,
  type BinanceInterval,
} from './constants'

export type ToolbarProps = {
  symbol: string
  interval: BinanceInterval
  overlays: string[]
  panes: string[]
  loading?: boolean
  error?: Nullable<string>
  onSymbolChange: (ticker: string) => void
  onIntervalChange: (interval: BinanceInterval) => void
  onToggleOverlay: (name: string) => void
  onTogglePane: (name: string) => void
}

export function Toolbar({
  symbol,
  interval,
  overlays,
  panes,
  loading,
  error,
  onSymbolChange,
  onIntervalChange,
  onToggleOverlay,
  onTogglePane,
}: ToolbarProps) {
  const t = useTranslations('klineChart')

  return (
    <div className='flex shrink-0 flex-col gap-1.5 border-b border-chrome-dark bg-window-body px-2 py-1.5'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <Select
          size='sm'
          aria-label={t('symbol')}
          className='min-w-[120px]'
          value={symbol}
          options={SYMBOLS.map((s) => ({ value: s.ticker, label: s.label }))}
          onChange={onSymbolChange}
        />
        <div className='flex flex-wrap items-center gap-0.5'>
          {INTERVALS.map((item) => (
            <Button
              key={item.value}
              size='sm'
              active={interval === item.value}
              variant={interval === item.value ? 'pressed' : 'raised'}
              onClick={() => onIntervalChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <span
          className={cn(
            'ml-auto text-[11px]',
            error ? 'text-red-700' : 'text-muted',
          )}
        >
          {error ? error : loading ? t('loading') : t('perpetual')}
        </span>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <IndicatorGroup
          label={t('mainChart')}
          items={OVERLAY_INDICATORS}
          active={overlays}
          onToggle={onToggleOverlay}
        />
        <IndicatorGroup
          label={t('subChart')}
          items={PANE_INDICATORS}
          active={panes}
          onToggle={onTogglePane}
        />
      </div>
    </div>
  )
}

function IndicatorGroup({
  label,
  items,
  active,
  onToggle,
}: {
  label: string
  items: { name: string; label: string }[]
  active: string[]
  onToggle: (name: string) => void
}) {
  return (
    <div className='flex flex-wrap items-center gap-0.5'>
      <span className='mr-1 text-[11px] text-muted'>{label}</span>
      {items.map((item) => {
        const on = active.includes(item.name)
        return (
          <Button
            key={item.name}
            size='sm'
            active={on}
            variant={on ? 'pressed' : 'raised'}
            onClick={() => onToggle(item.name)}
          >
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}
