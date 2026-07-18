'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Checkbox, Panel, Select } from '@/components/ui'
import { useSettingsStore } from '@/store/settings'

export function TaskbarSection() {
  const t = useTranslations('settings')
  const showTaskbarClock = useSettingsStore((s) => s.showTaskbarClock)
  const clockFormat = useSettingsStore((s) => s.clockFormat)
  const showTrayDecor = useSettingsStore((s) => s.showTrayDecor)
  const setShowTaskbarClock = useSettingsStore((s) => s.setShowTaskbarClock)
  const setClockFormat = useSettingsStore((s) => s.setClockFormat)
  const setShowTrayDecor = useSettingsStore((s) => s.setShowTrayDecor)

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.taskbar')}</h2>
      <p className='text-xs text-muted'>{t('taskbarHint')}</p>

      <Panel inset className='space-y-3'>
        <Checkbox
          checked={showTaskbarClock}
          onChange={(e) => setShowTaskbarClock(e.target.checked)}
          label={t('showClock')}
        />
        <div className={cn(!showTaskbarClock && 'opacity-50 pointer-events-none')}>
          <div className='text-xs font-bold mb-1.5'>{t('clockFormat')}</div>
          <Select
            size='sm'
            className='min-w-[140px]'
            value={clockFormat}
            onValueChange={(v) => setClockFormat(v as '12h' | '24h')}
            options={[
              { value: '24h', label: t('clock24') },
              { value: '12h', label: t('clock12') },
            ]}
          />
        </div>
        <Checkbox
          checked={showTrayDecor}
          onChange={(e) => setShowTrayDecor(e.target.checked)}
          label={t('showTrayDecor')}
        />
      </Panel>
    </div>
  )
}
