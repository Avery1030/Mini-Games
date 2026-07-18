'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Checkbox, Panel, Select } from '@/components/ui'
import { useSettingsStore } from '@/store/settings'

export function AppearanceSection() {
  const t = useTranslations('settings')
  const showIconLabels = useSettingsStore((s) => s.showIconLabels)
  const iconSize = useSettingsStore((s) => s.iconSize)
  const setShowIconLabels = useSettingsStore((s) => s.setShowIconLabels)
  const setIconSize = useSettingsStore((s) => s.setIconSize)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => setThemeMounted(true), [])
  const themeValue = themeMounted ? theme ?? 'system' : 'system'

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.appearance')}</h2>
      <p className='text-xs text-muted'>{t('appearanceHint')}</p>

      <Panel inset className='space-y-3'>
        <div>
          <div className='text-xs font-bold mb-1.5'>{t('colorTheme')}</div>
          <Select
            size='sm'
            className='min-w-[140px]'
            value={themeValue}
            onValueChange={(v) => setTheme(v)}
            options={[
              { value: 'system', label: t('themeSystem') },
              { value: 'light', label: t('themeLight') },
              { value: 'dark', label: t('themeDark') },
            ]}
          />
          <p className='mt-1 text-[10px] text-muted'>
            {t('themeResolved', {
              theme: themeMounted
                ? resolvedTheme === 'dark'
                  ? t('themeResolvedDark')
                  : t('themeResolvedLight')
                : '…',
            })}
          </p>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('iconSize')}</div>
          <Select
            size='sm'
            className='min-w-[140px]'
            value={iconSize}
            onValueChange={(v) => setIconSize(v as 'sm' | 'md' | 'lg')}
            options={[
              { value: 'sm', label: t('iconSm') },
              { value: 'md', label: t('iconMd') },
              { value: 'lg', label: t('iconLg') },
            ]}
          />
        </div>

        <Checkbox
          checked={showIconLabels}
          onChange={(e) => setShowIconLabels(e.target.checked)}
          label={t('showIconLabels')}
        />
      </Panel>
    </div>
  )
}
