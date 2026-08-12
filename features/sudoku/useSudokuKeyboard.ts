import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { SudokuSettings } from './settings'
import type { SudokuGame } from './sudoku-game'
import type { Position } from './types'
import type { SudokuScreen } from './useSudokuSession'

type Options = {
  screen: SudokuScreen
  gameRef: MutableRefObject<SudokuGame | null>
  settings: SudokuSettings
  selected: Position | null | undefined
  crackDemoRef: MutableRefObject<boolean>
  stepCrack: () => void
  stepCrackBack: () => void
  stopCrackDemo: () => void
  setLockedDigit: Dispatch<SetStateAction<number | null>>
}

/** 对局键盘快捷键 */
export function useSudokuKeyboard({
  screen,
  gameRef,
  settings,
  selected,
  crackDemoRef,
  stepCrack,
  stepCrackBack,
  stopCrackDemo,
  setLockedDigit,
}: Options) {
  useEffect(() => {
    if (screen !== 'play') return
    const onKey = (e: KeyboardEvent) => {
      if (crackDemoRef.current) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          stepCrack()
        } else if (e.key === 'Backspace' || e.key === 'ArrowLeft') {
          e.preventDefault()
          stepCrackBack()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          stopCrackDemo()
        }
        return
      }
      const game = gameRef.current
      if (!game) return
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        game.undo()
        return
      }
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        game.togglePause()
        return
      }
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const digit = Number(e.key)
        if (settings.selectDigitFirst) {
          setLockedDigit((prev) => (prev === digit ? null : digit))
          return
        }
        game.setValue(digit, {
          autoClearNotes: settings.autoClearNotes,
          autoUndoWrong: settings.autoUndoWrong,
        })
        return
      }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        game.setValue(0)
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        game.toggleNotesMode()
        return
      }
      if (!selected) return
      const { row, col } = selected
      if (e.key === 'ArrowUp' && row > 0) {
        e.preventDefault()
        game.selectCell(row - 1, col)
      } else if (e.key === 'ArrowDown' && row < 8) {
        e.preventDefault()
        game.selectCell(row + 1, col)
      } else if (e.key === 'ArrowLeft' && col > 0) {
        e.preventDefault()
        game.selectCell(row, col - 1)
      } else if (e.key === 'ArrowRight' && col < 8) {
        e.preventDefault()
        game.selectCell(row, col + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    screen,
    selected,
    crackDemoRef,
    stepCrack,
    stepCrackBack,
    stopCrackDemo,
    settings,
    gameRef,
    setLockedDigit,
  ])
}
