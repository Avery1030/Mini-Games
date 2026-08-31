/** 数独玩法设置（持久化） */

export type SudokuSettings = {
  /** 智能提示：提示优先用基础技法并展示依据 */
  smartHints: boolean
  /** 隐藏已全部填对的数字键 */
  hideUsedDigits: boolean
  /** 选中空格若为行/列/宫唯一空格，高亮其唯一答案 */
  highlightUnique: boolean
  /** 选中数字格时，突出含相同数字的笔记 */
  highlightSameNotes: boolean
  /** 选中数字格时，突出相同数字 */
  highlightSameDigits: boolean
  /** 突出选中格所在行、列、宫 */
  highlightRegions: boolean
  /** 填错后自动撤回该格 */
  autoUndoWrong: boolean
  /** 正确填入后自动清除同区域笔记中的该数字 */
  autoClearNotes: boolean
}

export type SudokuSettingKey = keyof SudokuSettings

export const DEFAULT_SUDOKU_SETTINGS: SudokuSettings = {
  smartHints: true,
  hideUsedDigits: true,
  highlightUnique: true,
  highlightSameNotes: true,
  highlightSameDigits: true,
  highlightRegions: true,
  autoUndoWrong: false,
  autoClearNotes: true,
}

export const SUDOKU_SETTING_KEYS: readonly SudokuSettingKey[] = [
  'smartHints',
  'hideUsedDigits',
  'highlightUnique',
  'highlightSameNotes',
  'highlightSameDigits',
  'highlightRegions',
  'autoUndoWrong',
  'autoClearNotes',
] as const

export function normalizeSudokuSettings(raw: unknown): SudokuSettings {
  const src = raw && typeof raw === 'object' ? (raw as Partial<SudokuSettings>) : {}
  const next = { ...DEFAULT_SUDOKU_SETTINGS }
  for (const key of SUDOKU_SETTING_KEYS) {
    if (typeof src[key] === 'boolean') next[key] = src[key]!
  }
  return next
}
