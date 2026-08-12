/** 数独棋盘高亮色（系统 chrome 语境下的选中/关联格） */
export const sudokuBoard = {
  cell: '#ffffff',
  selected: '#a8c4e8',
  peer: '#e8e8e8',
  sameDigit: '#c8dcf0',
  /** 同数字笔记高亮 */
  sameNote: '#d4e8c8',
  /** 唯一空格答案预览 */
  uniqueHint: '#f0d878',
  /** 逐步破解刚填入的目标格 */
  crackTarget: '#ffe08a',
  conflict: '#cc0000',
  givenDigit: '#000000',
  userDigit: '#000080',
  note: '#606060',
  gridLine: '#808080',
  gridThick: '#404040',
} as const
