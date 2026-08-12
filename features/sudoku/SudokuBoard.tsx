import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'
import { isCellConflicted, isPeer, isUniqueEmptyInUnit } from './sudoku-game'
import type { SudokuSettings } from './settings'
import { sudokuBoard as boardTheme } from './theme'
import type { CrackStep, SudokuState } from './types'

type Props = {
  state: SudokuState
  settings: SudokuSettings
  inputLocked: boolean
  showCrackCoords: boolean
  lastStep: CrackStep | null
  boardLabel: string
  onCellClick: (row: number, col: number) => void
}

export function SudokuBoard({
  state,
  settings,
  inputLocked,
  showCrackCoords,
  lastStep,
  boardLabel,
  onCellClick,
}: Props) {
  const renderCell = (r: number, c: number) => {
    const cell = state.board[r]![c]!
    const selected = state.selected?.row === r && state.selected?.col === c
    const crackHit = lastStep?.row === r && lastStep?.col === c
    const peer = settings.highlightRegions && isPeer(state.selected, r, c)
    const sameDigit =
      settings.highlightSameDigits &&
      state.highlightDigit > 0 &&
      cell.value === state.highlightDigit &&
      !selected &&
      !crackHit
    const sameNote =
      settings.highlightSameNotes &&
      state.highlightDigit > 0 &&
      cell.value === 0 &&
      cell.notes.includes(state.highlightDigit) &&
      !selected &&
      !crackHit
    const uniqueEmpty =
      settings.highlightUnique && selected && cell.value === 0 && isUniqueEmptyInUnit(state.board, r, c)
    const uniqueAnswer = uniqueEmpty ? state.solution[r]![c]! : 0
    const conflict = isCellConflicted(state.board, r, c)
    const thickRight = c === 2 || c === 5
    const thickBottom = r === 2 || r === 5

    let bg: string = boardTheme.cell
    if (crackHit) bg = boardTheme.crackTarget
    else if (uniqueEmpty) bg = boardTheme.uniqueHint
    else if (selected) bg = boardTheme.selected
    else if (sameDigit) bg = boardTheme.sameDigit
    else if (sameNote) bg = boardTheme.sameNote
    else if (peer) bg = boardTheme.peer

    return (
      <button
        key={`${r}-${c}`}
        type='button'
        disabled={inputLocked}
        onClick={() => onCellClick(r, c)}
        className='relative flex items-center justify-center select-none focus:outline-none disabled:cursor-default'
        style={{
          backgroundColor: bg,
          boxShadow:
            [
              thickRight ? `inset -2px 0 0 ${boardTheme.gridThick}` : null,
              thickBottom ? `inset 0 -2px 0 ${boardTheme.gridThick}` : null,
              crackHit ? `inset 0 0 0 2px ${boardTheme.gridThick}` : null,
            ]
              .filter(Boolean)
              .join(', ') || undefined,
        }}
      >
        {cell.value > 0 ? (
          <span
            className={cn(
              'font-bold leading-none tabular-nums',
              showCrackCoords ? 'text-[clamp(14px,3.8vw,20px)]' : 'text-[clamp(16px,4.2vw,22px)]',
            )}
            style={{
              color: conflict ? boardTheme.conflict : cell.given ? boardTheme.givenDigit : boardTheme.userDigit,
            }}
          >
            {cell.value}
          </span>
        ) : uniqueAnswer > 0 ? (
          <span
            className={cn(
              'font-bold leading-none tabular-nums opacity-70',
              showCrackCoords ? 'text-[clamp(14px,3.8vw,20px)]' : 'text-[clamp(16px,4.2vw,22px)]',
            )}
            style={{ color: boardTheme.userDigit }}
          >
            {uniqueAnswer}
          </span>
        ) : cell.notes.length > 0 ? (
          <span
            className={cn(
              'absolute inset-[2px] grid grid-cols-3 grid-rows-3 leading-none',
              showCrackCoords ? 'text-[7px]' : 'text-[8px]',
            )}
            style={{ color: boardTheme.note }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span
                key={n}
                className={cn(
                  'flex items-center justify-center',
                  settings.highlightSameNotes &&
                    state.highlightDigit === n &&
                    cell.notes.includes(n) &&
                    'font-bold text-green-800 dark:text-green-400',
                )}
              >
                {cell.notes.includes(n) ? n : ''}
              </span>
            ))}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div className='flex min-h-0 flex-1 items-center justify-center px-3 py-2'>
      <div className={cn(winChromeSunken, 'w-full max-w-[340px] aspect-square p-1.5')}>
        {showCrackCoords ? (
          <div
            className='grid h-full w-full'
            style={{
              gridTemplateColumns: '14px repeat(9, 1fr)',
              gridTemplateRows: '14px repeat(9, 1fr)',
              gap: 1,
              backgroundColor: boardTheme.gridLine,
            }}
            aria-label={boardLabel}
          >
            <div className='bg-chrome' />
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
              <div
                key={`col-${c}`}
                className={cn(
                  'flex items-center justify-center bg-chrome text-[9px] font-bold tabular-nums leading-none',
                  lastStep?.col === c ? 'text-accent' : 'text-muted',
                )}
              >
                {c + 1}
              </div>
            ))}
            {state.board.map((row, r) => (
              <div key={`row-wrap-${r}`} className='contents'>
                <div
                  className={cn(
                    'flex items-center justify-center bg-chrome text-[9px] font-bold tabular-nums leading-none',
                    lastStep?.row === r ? 'text-accent' : 'text-muted',
                  )}
                >
                  {r + 1}
                </div>
                {row.map((_, c) => renderCell(r, c))}
              </div>
            ))}
          </div>
        ) : (
          <div
            className='grid h-full w-full grid-cols-9'
            style={{
              gridTemplateRows: 'repeat(9, 1fr)',
              gap: 1,
              backgroundColor: boardTheme.gridLine,
            }}
            aria-label={boardLabel}
          >
            {state.board.map((row, r) => row.map((_, c) => renderCell(r, c)))}
          </div>
        )}
      </div>
    </div>
  )
}
