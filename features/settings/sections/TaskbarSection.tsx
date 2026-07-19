'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Checkbox, Panel, Select } from '@/components/ui'
import { useTaskbarSettings } from '@/hooks/settings'
import { patchSettings } from '@/store/settings'

export function TaskbarSection() {
  const t = useTranslations('settings')
  const { showTaskbarClock, clockFormat, showTrayDecor } = useTaskbarSettings()

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.taskbar')}</h2>
      <p className='text-xs text-muted'>{t('taskbarHint')}</p>

      <Panel inset className='space-y-3'>
        <Checkbox
          checked={showTaskbarClock}
          onChange={(e) => patchSettings({ showTaskbarClock: e.target.checked })}
          label={t('showClock')}
        />
        <div className={cn(!showTaskbarClock && 'opacity-50 pointer-events-none')}>
          <div className='text-xs font-bold mb-1.5'>{t('clockFormat')}</div>
          <Select
            size='sm'
            className='min-w-[140px]'
            value={clockFormat}
            onValueChange={(v) => patchSettings({ clockFormat: v as '12h' | '24h' })}
            options={[
              { value: '24h', label: t('clock24') },
              { value: '12h', label: t('clock12') },
            ]}
          />
        </div>
        <Checkbox
          checked={showTrayDecor}
          onChange={(e) => patchSettings({ showTrayDecor: e.target.checked })}
          label={t('showTrayDecor')}
        />
      </Panel>
    </div>
  )
}
