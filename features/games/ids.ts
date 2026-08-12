import type { DesktopAppId } from '@/config/desktop'

/** 收纳进「游戏」集合的内置小游戏 id（顺序即列表展示顺序） */
export const GAME_APP_IDS: readonly DesktopAppId[] = [
  'minesweeper',
  'tetris',
  'suika',
  'tileMatch',
  'match3',
  'imagePuzzle',
  'canvasJigsaw',
  'sokoban',
  'sudoku',
] as const
