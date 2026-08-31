import { cn } from '@/lib/cn'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import type { Cell } from './types'

/** 统计盘面各数字出现次数（index 1–9） */
export function countDigitsOnBoard(board: Cell[][]): number[] {
  const counts = Array(10).fill(0) as number[]
  for (const cell of board.flat()) {
    if (cell.value > 0) counts[cell.value]!++
  }
  return counts
}

type Props = {
  digitCounts: number[]
  hideUsedDigits: boolean
  selectDigitFirst: boolean
  lockedDigit: Nullable<number>
  inputLocked: boolean
  won: boolean
  onDigitClick: (digit: number) => void
}

export function DigitPad({
  digitCounts,
  hideUsedDigits,
  selectDigitFirst,
  lockedDigit,
  inputLocked,
  won,
  onDigitClick,
}: Props) {
  return (
    <div className='shrink-0 flex justify-center gap-1 px-3 pt-1 pb-3 max-w-[400px] w-full mx-auto'>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const done = digitCounts[d]! >= 9
        if (hideUsedDigits && done) return null
        return (
          <button
            key={d}
            type='button'
            disabled={inputLocked || done || won}
            onClick={() => onDigitClick(d)}
            className={cn(
              selectDigitFirst && lockedDigit === d ? winChromePressed : winChrome,
              'h-10 min-w-8 flex-1 max-w-10 text-base font-bold tabular-nums disabled:opacity-40',
            )}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}
