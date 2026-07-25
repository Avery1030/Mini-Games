'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Checkbox, Panel, Select } from '@/components/ui'
import { UI_SCALE_OPTIONS, uiScalePercent, type UiScale } from '@/lib/uiScale'
import { useAppearanceSettings } from '@/hooks/settings'
import {
  SCREENSAVER_IDLE_OPTIONS,
  patchSettings,
  type ScreensaverIdleMinutes,
} from '@/store/settings'

export function AppearanceSection() {
  const t = useTranslations('settings')
  const {
    showIconLabels,
    iconSize,
    uiScale,
    openWindowsMaximized,
    screensaverEnabled,
    screensaverIdleMinutes,
  } = useAppearanceSettings()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => setThemeMounted(true), [])
  const themeValue = themeMounted ? (theme ?? 'light') : 'light'
  const scalePercent = uiScalePercent(uiScale)

  const scaleLabelKey = {
    xs: 'uiScaleXs',
    sm: 'uiScaleSm',
    md: 'uiScaleMd',
    lg: 'uiScaleLg',
    xl: 'uiScaleXl',
    '2xl': 'uiScale2xl',
    '3xl': 'uiScale3xl',
  } as const satisfies Record<UiScale, string>

  return (
    <div className='flex-1 min-h-0 overflow-y-auto p-3 space-y-3'>
      <h2 className='text-base font-bold mb-1'>{t('sections.appearance')}</h2>
      <p className='text-xs text-muted'>{t('appearanceHint')}</p>

      <Panel inset className='space-y-3'>
        <div>
          <div className='text-xs font-bold mb-1.5'>{t('uiScale')}</div>
          <Select
            size='sm'
            className='min-w-[180px]'
            value={uiScale}
            onValueChange={(v) => patchSettings({ uiScale: v as UiScale })}
            options={UI_SCALE_OPTIONS.map((value) => ({
              value,
              label: t(scaleLabelKey[value]),
            }))}
          />
          <p className='mt-1 text-[10px] text-muted'>{t('uiScaleHint', { percent: scalePercent })}</p>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('colorTheme')}</div>
          <Select
            size='sm'
            className='min-w-[140px]'
            value={themeValue}
            onValueChange={(v) => setTheme(v)}
            options={[
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
            onValueChange={(v) => patchSettings({ iconSize: v as 'sm' | 'md' | 'lg' })}
            options={[
              { value: 'sm', label: t('iconSm') },
              { value: 'md', label: t('iconMd') },
              { value: 'lg', label: t('iconLg') },
            ]}
          />
          <p className='mt-1 text-[10px] text-muted'>{t('iconSizeHint')}</p>
        </div>

        <Checkbox
          checked={showIconLabels}
          onChange={(e) => patchSettings({ showIconLabels: e.target.checked })}
          label={t('showIconLabels')}
        />
        <p className='-mt-1 text-[10px] text-muted'>{t('showIconLabelsHint')}</p>

        <Checkbox
          checked={openWindowsMaximized}
          onChange={(e) => patchSettings({ openWindowsMaximized: e.target.checked })}
          label={t('openWindowsMaximized')}
        />
        <p className='-mt-1 text-[10px] text-muted'>{t('openWindowsMaximizedHint')}</p>

        <div className='border-t border-chrome-dark pt-3 space-y-3'>
          <Checkbox
            checked={screensaverEnabled}
            onChange={(e) => patchSettings({ screensaverEnabled: e.target.checked })}
            label={t('screensaverEnabled')}
          />
          <p className='-mt-1 text-[10px] text-muted'>{t('screensaverEnabledHint')}</p>

          <div>
            <div className='text-xs font-bold mb-1.5'>{t('screensaverIdle')}</div>
            <Select
              size='sm'
              className='min-w-[180px]'
              value={String(screensaverIdleMinutes)}
              disabled={!screensaverEnabled}
              onValueChange={(v) =>
                patchSettings({ screensaverIdleMinutes: Number(v) as ScreensaverIdleMinutes })
              }
              options={SCREENSAVER_IDLE_OPTIONS.map((minutes) => ({
                value: String(minutes),
                label:
                  minutes === 0
                    ? t('screensaverIdleNever')
                    : t('screensaverIdleMinutes', { minutes }),
              }))}
            />
            <p className='mt-1 text-[10px] text-muted'>{t('screensaverIdleHint')}</p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
