import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { winChrome, winChromePressed } from '@/lib/winChrome'
import { MOVE_ANIM_MS } from './boardCanvas'
import type { Direction } from './types'

export const MOVE_COOLDOWN_MS = MOVE_ANIM_MS
export const CELL_MIN = 24
export const CELL_MAX = 48

export function keyToDir(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up'
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down'
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left'
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right'
    default:
      return null
  }
}

export function pad3(n: number): string {
  return String(Math.max(0, Math.min(999, n))).padStart(3, '0')
}

export function formatBest(ready: boolean, minMoves: number | null): string {
  if (!ready) return '···'
  if (minMoves == null) return '---'
  return pad3(minMoves)
}

export function LcdStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className='flex flex-col items-center gap-0.5 min-w-[52px]'>
      <span className='text-[10px] text-muted leading-none'>{label}</span>
      <div
        className={cn(
          'border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light',
          'px-1.5 py-0.5 font-mono text-sm tracking-wider tabular-nums leading-none',
          accent
            ? 'bg-[#0f2410] text-[#4dff7a] dark:bg-[#0a1f0c] dark:text-[#5dff88]'
            : 'bg-[#1a1a1a] text-[#ff4040] dark:bg-[#0d0d0d] dark:text-[#ff5555]',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function DpadButton({
  label,
  pressed,
  onPress,
  className,
  children,
}: {
  label: string
  pressed: boolean
  onPress: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type='button'
      aria-label={label}
      className={cn(
        pressed ? winChromePressed : winChrome,
        'h-10 w-11 text-base font-bold select-none touch-manipulation',
        className,
      )}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress()
      }}
    >
      {children}
    </button>
  )
}

export function Dpad({
  heldDir,
  disabled,
  labels,
  onMove,
}: {
  heldDir: Direction | null
  disabled?: boolean
  labels: { up: string; down: string; left: string; right: string }
  onMove: (dir: Direction) => void
}) {
  return (
    <div
      className={cn(
        'shrink-0 px-2 pb-1 flex flex-col items-center gap-1',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <DpadButton label={labels.up} pressed={heldDir === 'up'} onPress={() => onMove('up')}>
        ↑
      </DpadButton>
      <div className='flex items-center gap-1'>
        <DpadButton label={labels.left} pressed={heldDir === 'left'} onPress={() => onMove('left')}>
          ←
        </DpadButton>
        <div className={cn(winChromePressed, 'h-10 w-11 opacity-60 pointer-events-none')} aria-hidden />
        <DpadButton label={labels.right} pressed={heldDir === 'right'} onPress={() => onMove('right')}>
          →
        </DpadButton>
      </div>
      <DpadButton label={labels.down} pressed={heldDir === 'down'} onPress={() => onMove('down')}>
        ↓
      </DpadButton>
    </div>
  )
}
