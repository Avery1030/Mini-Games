'use client'

import { Switch } from '@/components/ui'
import { cn } from '@/lib/cn'
import { winChrome, winChromePanel } from '@/lib/winChrome'
import { SUDOKU_SETTING_KEYS, type SudokuSettingKey, type SudokuSettings } from './settings'
import { MenuActionBtn } from './uiParts'

export type SettingsPanelLabels = {
  title: string
  close: string
  reset: string
  levelSelect: string
  backDifficulty: string
  crack?: string
  settings: Record<SudokuSettingKey, { title: string; desc: string }>
}

type Props = {
  settings: SudokuSettings
  labels: SettingsPanelLabels
  showCrack?: boolean
  onChange: <K extends SudokuSettingKey>(key: K, value: SudokuSettings[K]) => void
  onReset: () => void
  onLevelSelect: () => void
  onBackDifficulty: () => void
  onCrack?: () => void
  onClose: () => void
}

export function SettingsPanel({
  settings,
  labels,
  showCrack,
  onChange,
  onReset,
  onLevelSelect,
  onBackDifficulty,
  onCrack,
  onClose,
}: Props) {
  return (
    <div
      className='absolute inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/50 dark:bg-black/60'
      onClick={onClose}
    >
      <div
        className={cn(winChromePanel, 'w-full max-w-[360px] max-h-[85%] flex flex-col bg-chrome text-on-chrome')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='shrink-0 px-3 py-2 border-b border-chrome-dark flex items-center justify-between gap-2'>
          <p className='text-sm font-bold'>{labels.title}</p>
          <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onClose}>
            {labels.close}
          </button>
        </div>

        <div className='min-h-0 flex-1 overflow-auto'>
          <ul className='divide-y divide-chrome-dark/40'>
            {SUDOKU_SETTING_KEYS.map((key) => {
              const copy = labels.settings[key]
              return (
                <li key={key} className='flex items-start gap-2 px-3 py-2.5'>
                  <div className='min-w-0 flex-1'>
                    <p className='text-[12px] font-semibold leading-snug'>{copy.title}</p>
                    <p className='mt-0.5 text-[10px] text-muted leading-snug'>{copy.desc}</p>
                  </div>
                  <Switch
                    size='md'
                    checked={settings[key]}
                    onCheckedChange={(v) => onChange(key, v)}
                    className='shrink-0 mt-0.5'
                    aria-label={copy.title}
                  />
                </li>
              )
            })}
          </ul>
        </div>

        <div className='shrink-0 flex flex-col gap-1 p-2 border-t border-chrome-dark'>
          <MenuActionBtn label={labels.reset} onClick={onReset} />
          <MenuActionBtn label={labels.levelSelect} onClick={onLevelSelect} />
          <MenuActionBtn label={labels.backDifficulty} onClick={onBackDifficulty} />
          {showCrack && labels.crack && onCrack ? <MenuActionBtn label={labels.crack} onClick={onCrack} /> : null}
        </div>
      </div>
    </div>
  )
}
