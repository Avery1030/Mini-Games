'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { UI_STYLE_OPTIONS, type UiStyleId } from '@/config/uiThemes'

type Props = {
  value: UiStyleId
  onChange: (id: UiStyleId) => void
}

export function ThemeStylePicker({ value, onChange }: Props) {
  const t = useTranslations('settings')
  return (
    <div className='grid grid-cols-2 gap-2 max-md:grid-cols-1'>
      {UI_STYLE_OPTIONS.map((id) => {
        const selected = id === value
        return (
          <button
            key={id}
            type='button'
            onClick={() => onChange(id)}
            className={cn(
              'text-left p-1.5',
              selected ? 'bg-[var(--window-title-active)] text-[var(--window-title-text)]' : 'hover:bg-chrome-hover',
            )}
            aria-pressed={selected}
          >
            <span
              data-ui-style={id}
              className='block h-16 overflow-hidden text-on-chrome'
              style={{
                background: 'var(--desktop-bg, #3a8f8c)',
                fontFamily: 'var(--ui-font)',
              }}
            >
              <span className='ui-window m-2 mt-3 flex h-12 flex-col bg-window text-on-chrome'>
                <span className='ui-titlebar h-4 shrink-0 px-1 text-[9px] font-bold leading-4 text-[var(--window-title-text)]'>
                  {t(`uiStyle${capitalize(id)}`)}
                </span>
                <span className='flex flex-1 items-center gap-1 px-1'>
                  <span className='ui-raised bg-chrome px-1 text-[8px] leading-4'>{t('themePreviewOk')}</span>
                  <span className='ui-sunken bg-field h-3 flex-1' />
                </span>
              </span>
            </span>
            <span className='mt-1 block text-[10px] font-bold'>{t(`uiStyle${capitalize(id)}`)}</span>
            <span className={cn('block text-[10px]', selected ? 'opacity-90' : 'text-muted')}>
              {t(`uiStyle${capitalize(id)}Hint`)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function capitalize(id: UiStyleId): 'Classic' | 'Luna' | 'Aqua' | 'Flat' {
  return (id.charAt(0).toUpperCase() + id.slice(1)) as 'Classic' | 'Luna' | 'Aqua' | 'Flat'
}
