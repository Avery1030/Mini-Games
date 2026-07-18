'use client'

import { useTranslations } from 'next-intl'
import { Checkbox, Panel } from '@/components/ui'
import { useSettingsStore } from '@/store/settings'

export function DesktopIconsSection() {
  const t = useTranslations('settings')
  const hidePlaceholderIcons = useSettingsStore((s) => s.hidePlaceholderIcons)
  const setHidePlaceholderIcons = useSettingsStore((s) => s.setHidePlaceholderIcons)

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.desktop')}</h2>
      <p className='text-xs text-muted'>{t('desktopHint')}</p>

      <Panel inset className='space-y-3'>
        <Checkbox
          checked={hidePlaceholderIcons}
          onChange={(e) => setHidePlaceholderIcons(e.target.checked)}
          label={t('hidePlaceholders')}
        />
        <p className='text-[10px] text-muted leading-relaxed'>{t('hidePlaceholdersHelp')}</p>
      </Panel>
    </div>
  )
}
