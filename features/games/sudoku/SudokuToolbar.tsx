import { Eraser, Lightbulb, PenLine, RotateCcw, Sparkles, StepBack, StepForward, X } from 'lucide-react'
import { Switch } from '@/components/ui'
import type { CrackPhase } from './useCrackDemo'
import { ToolBtn } from './uiParts'

type Props = {
  inputLocked: boolean
  canUndo: boolean
  notesMode: boolean
  hintsLeft: number
  playing: boolean
  crackEnabled: boolean
  crackPhase: CrackPhase
  canStepForward: boolean
  canStepBack: boolean
  labels: {
    erase: string
    undo: string
    notes: string
    hint: string
    crack: string
    crackPrev: string
    crackNext: string
    crackStop: string
    crackManualHint: string
  }
  statusText: Nullable<string>
  reasonText: Nullable<string>
  showManualHint: boolean
  hintReasonText: Nullable<string>
  onErase: () => void
  onUndo: () => void
  onToggleNotes: () => void
  onHint: () => void
  onCrackOpen: () => void
  onCrackPrev: () => void
  onCrackNext: () => void
  onCrackStop: () => void
}

export function SudokuToolbar({
  inputLocked,
  canUndo,
  notesMode,
  hintsLeft,
  playing,
  crackEnabled,
  crackPhase,
  canStepForward,
  canStepBack,
  labels,
  statusText,
  reasonText,
  showManualHint,
  hintReasonText,
  onErase,
  onUndo,
  onToggleNotes,
  onHint,
  onCrackOpen,
  onCrackPrev,
  onCrackNext,
  onCrackStop,
}: Props) {
  return (
    <div className='shrink-0 flex flex-col items-center gap-1.5 px-3 pt-1 pb-2'>
      <div className='flex justify-center gap-2 sm:gap-3 flex-wrap'>
        <ToolBtn
          label={labels.erase}
          disabled={inputLocked}
          onClick={onErase}
          icon={<Eraser size={16} strokeWidth={2} />}
        />
        <ToolBtn
          label={labels.undo}
          disabled={inputLocked || !canUndo}
          onClick={onUndo}
          icon={<RotateCcw size={16} strokeWidth={2} />}
        />
        <ToolBtn
          label={labels.notes}
          disabled={inputLocked}
          onClick={onToggleNotes}
          active={notesMode}
          icon={<PenLine size={16} strokeWidth={2} />}
          badge={<Switch readOnly size='sm' checked={notesMode} className='absolute -top-1 -right-1' />}
        />
        <ToolBtn
          label={labels.hint}
          disabled={inputLocked || hintsLeft <= 0}
          onClick={onHint}
          icon={<Lightbulb size={16} strokeWidth={2} />}
          badge={
            <span className='absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 border border-chrome-dark bg-field text-[9px] font-bold leading-[14px] text-center tabular-nums'>
              {hintsLeft}
            </span>
          }
        />
        {crackEnabled ? (
          crackPhase === 'manual' ? (
            <>
              <ToolBtn
                label={labels.crackPrev}
                disabled={!canStepBack}
                onClick={onCrackPrev}
                icon={<StepBack size={16} strokeWidth={2} />}
              />
              <ToolBtn
                label={labels.crackNext}
                disabled={!canStepForward}
                onClick={onCrackNext}
                icon={<StepForward size={16} strokeWidth={2} />}
              />
              <ToolBtn label={labels.crackStop} onClick={onCrackStop} icon={<X size={16} strokeWidth={2} />} />
            </>
          ) : (
            <ToolBtn
              label={labels.crack}
              disabled={!playing}
              onClick={onCrackOpen}
              icon={<Sparkles size={16} strokeWidth={2} />}
            />
          )
        ) : null}
      </div>
      {statusText || reasonText || hintReasonText || showManualHint ? (
        <div className='w-full max-w-[400px] px-1 space-y-0.5'>
          {statusText ? <p className='text-[11px] text-muted text-center'>{statusText}</p> : null}
          {reasonText ? (
            <p className='text-[11px] text-on-chrome text-center leading-snug'>{reasonText}</p>
          ) : showManualHint ? (
            <p className='text-[11px] text-muted text-center'>{labels.crackManualHint}</p>
          ) : null}
          {hintReasonText && !reasonText ? (
            <p className='text-[11px] text-on-chrome text-center leading-snug'>{hintReasonText}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
