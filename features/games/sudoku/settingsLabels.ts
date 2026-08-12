import type { useTranslations } from 'next-intl'
import type { SettingsPanelLabels } from './SettingsPanel'

type SudokuT = ReturnType<typeof useTranslations<'sudoku'>>

/** 组装设置面板文案，避免在主组件里堆嵌套对象 */
export function buildSettingsPanelLabels(t: SudokuT): SettingsPanelLabels {
  return {
    title: t('settings'),
    close: t('settingsClose'),
    reset: t('reset'),
    levelSelect: t('levelSelect'),
    backDifficulty: t('backDifficulty'),
    crack: t('crack'),
    settings: {
      smartHints: { title: t('opt.smartHints'), desc: t('optDesc.smartHints') },
      hideUsedDigits: { title: t('opt.hideUsedDigits'), desc: t('optDesc.hideUsedDigits') },
      highlightUnique: { title: t('opt.highlightUnique'), desc: t('optDesc.highlightUnique') },
      highlightSameNotes: { title: t('opt.highlightSameNotes'), desc: t('optDesc.highlightSameNotes') },
      highlightSameDigits: { title: t('opt.highlightSameDigits'), desc: t('optDesc.highlightSameDigits') },
      highlightRegions: { title: t('opt.highlightRegions'), desc: t('optDesc.highlightRegions') },
      selectDigitFirst: { title: t('opt.selectDigitFirst'), desc: t('optDesc.selectDigitFirst') },
      autoUndoWrong: { title: t('opt.autoUndoWrong'), desc: t('optDesc.autoUndoWrong') },
      autoClearNotes: { title: t('opt.autoClearNotes'), desc: t('optDesc.autoClearNotes') },
    },
  }
}
