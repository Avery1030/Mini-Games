'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Checkbox, Panel, Select } from '@/components/ui'
import { UI_SCALE_OPTIONS, uiScalePercent, type UiScale } from '@/lib/uiScale'
import { resolveThemeSwatch } from '@/lib/uiTheme'
import { useAppearanceSettings } from '@/features/settings/hooks'
import { ThemeStylePicker } from '@/features/settings/ThemeStylePicker'
import {
  DEFAULT_CUSTOM_THEME,
  DEFAULT_UI_PALETTE,
  DEFAULT_UI_STYLE,
  UI_PALETTE_OPTIONS,
  type CustomUiTheme,
  type UiPaletteId,
  type UiStyleId,
} from '@/config/uiThemes'
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
    uiStyle,
    uiPalette,
    customUiTheme,
  } = useAppearanceSettings()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [themeMounted, setThemeMounted] = useState(false)
  useEffect(() => setThemeMounted(true), [])
  const themeValue = themeMounted ? (theme ?? 'light') : 'light'
  const scalePercent = uiScalePercent(uiScale)

  const paletteLabelKey = {
    follow: 'uiPaletteFollow',
    luna: 'uiPaletteLuna',
    olive: 'uiPaletteOlive',
    candy: 'uiPaletteCandy',
    midnight: 'uiPaletteMidnight',
    custom: 'uiPaletteCustom',
  } as const satisfies Record<UiPaletteId, string>

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
          <div className='text-xs font-bold mb-1.5'>{t('uiStyle')}</div>
          <ThemeStylePicker
            value={uiStyle}
            onChange={(id: UiStyleId) => patchSettings({ uiStyle: id })}
          />
          <p className='mt-1 text-[10px] text-muted'>{t('uiStyleHint')}</p>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('uiPalette')}</div>
          <Select
            size='sm'
            className='min-w-[180px] max-md:min-w-0 max-md:w-full'
            value={uiPalette}
            onValueChange={(v) => patchSettings({ uiPalette: v as UiPaletteId })}
            options={UI_PALETTE_OPTIONS.map((value) => ({
              value,
              label: t(paletteLabelKey[value]),
            }))}
          />
          <p className='mt-1 text-[10px] text-muted'>{t('uiPaletteHint')}</p>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('customColors')}</div>
          <div className='grid grid-cols-2 gap-2'>
            {(
              [
                ['chrome', 'customChrome'],
                ['title', 'customTitle'],
                ['accent', 'customAccent'],
                ['field', 'customField'],
              ] as const
            ).map(([key, labelKey]) => (
              <label key={key} className='flex items-center gap-2 text-[11px]'>
                <input
                  type='color'
                  className='h-6 w-8 shrink-0 cursor-pointer bg-transparent p-0 border border-chrome-dark'
                  value={resolveThemeSwatch(uiPalette, customUiTheme)[key]}
                  onChange={(e) => {
                    const next: CustomUiTheme = {
                      ...(customUiTheme ?? DEFAULT_CUSTOM_THEME),
                      ...resolveThemeSwatch(uiPalette, customUiTheme),
                      [key]: e.target.value,
                    }
                    patchSettings({ uiPalette: 'custom', customUiTheme: next })
                  }}
                />
                <span>{t(labelKey)}</span>
              </label>
            ))}
          </div>
          <p className='mt-1 text-[10px] text-muted'>{t('customColorsHint')}</p>
          <Button
            size='sm'
            className='mt-2'
            disabled={
              uiStyle === DEFAULT_UI_STYLE &&
              uiPalette === DEFAULT_UI_PALETTE &&
              customUiTheme == null &&
              themeValue === 'light'
            }
            onClick={() => {
              patchSettings({
                uiStyle: DEFAULT_UI_STYLE,
                uiPalette: DEFAULT_UI_PALETTE,
                customUiTheme: null,
              })
              setTheme('light')
            }}
          >
            {t('resetTheme')}
          </Button>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('uiScale')}</div>
          <Select
            size='sm'
            className='min-w-[180px] max-md:min-w-0 max-md:w-full'
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
            className='min-w-[140px] max-md:min-w-0 max-md:w-full'
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
            })}{' '}
            {t('themeFollowHint')}
          </p>
        </div>

        <div>
          <div className='text-xs font-bold mb-1.5'>{t('iconSize')}</div>
          <Select
            size='sm'
            className='min-w-[140px] max-md:min-w-0 max-md:w-full'
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
              className='min-w-[180px] max-md:min-w-0 max-md:w-full'
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
