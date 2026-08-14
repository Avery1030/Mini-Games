'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { useSudokuProgressStore } from '@/store'
import { CrackModeMenu } from './CrackModeMenu'
import { DigitPad, countDigitsOnBoard } from './DigitPad'
import { DifficultySelect } from './DifficultySelect'
import { LevelSelect } from './LevelSelect'
import { PauseOverlay } from './PauseOverlay'
import { PlayHeader, StatusBar } from './PlayChrome'
import { SettingsPanel } from './SettingsPanel'
import { SudokuBoard } from './SudokuBoard'
import { SudokuToolbar } from './SudokuToolbar'
import { buildSettingsPanelLabels } from './settingsLabels'
import { MAX_HINTS, SudokuGame, formatElapsed } from './sudoku-game'
import type { CrackMode, CrackStep } from './types'
import { progressKey } from './types'
import { useCrackDemo } from './useCrackDemo'
import { useSudokuKeyboard } from './useSudokuKeyboard'
import { useSudokuSession } from './useSudokuSession'
import { WinDialog } from './WinDialog'

export interface SudokuProps {
  embedded?: boolean
}

export function Sudoku({ embedded = false }: SudokuProps = {}) {
  const t = useTranslations('sudoku')
  const settings = useSudokuProgressStore((s) => s.settings)
  const setSetting = useSudokuProgressStore((s) => s.setSetting)

  const gameRef = useRef<SudokuGame | null>(null)
  const [lockedDigit, setLockedDigit] = useState<number | null>(null)
  const [hintStep, setHintStep] = useState<CrackStep | null>(null)
  const [resultDismissed, setResultDismissed] = useState(false)

  const {
    enabled: crackEnabled,
    crackPhase,
    crackProgress,
    lastStep,
    crackError,
    crackDemoRef,
    canStepForward,
    canStepBack,
    startCrack,
    stepCrack,
    stepCrackBack,
    stopCrackDemo,
  } = useCrackDemo({ gameRef })

  const {
    screen,
    difficulty,
    levelId,
    state,
    settingsOpen,
    setSettingsOpen,
    crackMenuOpen,
    setCrackMenuOpen,
    progressLevels,
    catalog,
    difficultyItems,
    levelSelectItems,
    pickDifficulty,
    backToLevels,
    backToDifficulty,
    startLevel,
    resetLevel,
    goNext,
  } = useSudokuSession({ gameRef, stopCrackDemo })

  useEffect(() => {
    if (state?.status === 'playing') setResultDismissed(false)
  }, [state?.status])

  useSudokuKeyboard({
    screen,
    gameRef,
    settings,
    selected: state?.selected,
    crackDemoRef,
    stepCrack,
    stepCrackBack,
    stopCrackDemo,
    setLockedDigit,
  })

  const shell = cn(embeddedAppShell(embedded, 'relative flex flex-col bg-chrome text-on-chrome min-h-0'), 'h-full')

  if (screen === 'difficulty') {
    return (
      <div className={shell}>
        <DifficultySelect
          items={difficultyItems}
          labels={{
            title: t('difficultyTitle'),
            hint: t('difficultyHint'),
            levels: t('levels'),
            cleared: t('cleared'),
            difficulty: {
              easy: t('difficulty.easy'),
              medium: t('difficulty.medium'),
              hard: t('difficulty.hard'),
              expert: t('difficulty.expert'),
            },
            difficultyHint: {
              easy: t('difficultyDesc.easy'),
              medium: t('difficultyDesc.medium'),
              hard: t('difficultyDesc.hard'),
              expert: t('difficultyDesc.expert'),
            },
          }}
          onPick={pickDifficulty}
        />
      </div>
    )
  }

  if (screen === 'levels' && difficulty) {
    return (
      <div className={shell}>
        <LevelSelect
          items={levelSelectItems}
          empty={catalog.length === 0}
          labels={{
            title: t('selectTitleDiff', { difficulty: t(`difficulty.${difficulty}`) }),
            hint: t('selectHint'),
            empty: t('levelsEmpty'),
            levelN: (n) => t('levelN', { n }),
            locked: t('locked'),
            cleared: t('cleared'),
            bestTime: t('bestTime'),
            clues: t('clues'),
            back: t('backDifficulty'),
          }}
          onPick={startLevel}
          onBack={backToDifficulty}
          formatTime={formatElapsed}
        />
      </div>
    )
  }

  if (!state || !difficulty) return null

  const digitCounts = countDigitsOnBoard(state.board)
  const levelIdx = levelId != null ? catalog.indexOf(levelId) : -1
  const hasNext = levelIdx >= 0 && levelIdx < catalog.length - 1
  const displayIndex = levelIdx >= 0 ? levelIdx + 1 : state.levelId
  const hintsLeft = Math.max(0, MAX_HINTS - state.hintsUsed)
  const demoBusy = crackPhase === 'manual'
  const showCrackCoords = crackPhase === 'manual' || lastStep != null
  const inputLocked = state.paused || state.status !== 'playing' || demoBusy

  const fillOpts = {
    autoClearNotes: settings.autoClearNotes,
    autoUndoWrong: settings.autoUndoWrong,
  }

  const fillDigit = (digit: number) => {
    gameRef.current?.setValue(digit, fillOpts)
    setHintStep(null)
  }

  const onDigitPadClick = (d: number) => {
    if (settings.selectDigitFirst) {
      setLockedDigit((prev) => (prev === d ? null : d))
      return
    }
    fillDigit(d)
  }

  const onCellClick = (r: number, c: number) => {
    const game = gameRef.current
    if (!game) return
    if (settings.selectDigitFirst && lockedDigit != null && !state.notesMode) {
      game.selectCell(r, c)
      game.setValue(lockedDigit, fillOpts)
      setHintStep(null)
      return
    }
    game.selectCell(r, c)
  }

  const applyHint = () => {
    const step = gameRef.current?.applyHint({
      smart: settings.smartHints,
      autoClearNotes: settings.autoClearNotes,
    })
    setHintStep(settings.smartHints ? (step ?? null) : null)
  }

  const openCrackMenu = () => {
    if (state.status !== 'playing') return
    if (state.paused) gameRef.current?.resume()
    setSettingsOpen(false)
    setCrackMenuOpen(true)
  }

  const pickCrackMode = (mode: CrackMode) => {
    setCrackMenuOpen(false)
    startCrack(mode)
  }

  const reasonParams = (step: CrackStep) => ({
    row: step.row + 1,
    col: step.col + 1,
    value: step.value,
  })

  const crackReasonText = lastStep ? t(`crackReason.${lastStep.reason}`, reasonParams(lastStep)) : null
  const hintReasonText = hintStep ? t(`crackReason.${hintStep.reason}`, reasonParams(hintStep)) : null
  const crackStatusText =
    crackError === 'unsolvable'
      ? t('crackFailed')
      : crackProgress
        ? t('crackProgress', { step: crackProgress.step, total: crackProgress.total })
        : null

  return (
    <div className={shell}>
      <PlayHeader
        title={t('levelShort', { n: displayIndex })}
        backLabel={t('levelSelect')}
        settingsLabel={t('settings')}
        settingsDisabled={demoBusy}
        onBack={backToLevels}
        onOpenSettings={() => {
          if (demoBusy) return
          if (state.status === 'playing' && !state.paused) gameRef.current?.pause()
          setSettingsOpen(true)
        }}
      />

      <StatusBar
        difficultyLabel={t(`difficulty.${difficulty}`)}
        mistakesLabel={t('mistakesLabel')}
        mistakes={state.mistakes}
        elapsed={state.elapsed}
        paused={state.paused}
        pauseLabel={t('pause')}
        resumeLabel={t('resume')}
        pauseDisabled={state.status !== 'playing' || demoBusy}
        onTogglePause={() => gameRef.current?.togglePause()}
      />

      <SudokuBoard
        state={state}
        settings={settings}
        inputLocked={inputLocked}
        showCrackCoords={showCrackCoords}
        lastStep={lastStep}
        boardLabel={t('boardLabel')}
        onCellClick={onCellClick}
      />

      <SudokuToolbar
        inputLocked={inputLocked}
        canUndo={state.canUndo}
        notesMode={state.notesMode}
        hintsLeft={hintsLeft}
        playing={state.status === 'playing'}
        crackEnabled={crackEnabled}
        crackPhase={crackPhase}
        canStepForward={canStepForward}
        canStepBack={canStepBack}
        labels={{
          erase: t('erase'),
          undo: t('undo'),
          notes: t('notes'),
          hint: t('hint'),
          crack: t('crack'),
          crackPrev: t('crackPrev'),
          crackNext: t('crackNext'),
          crackStop: t('crackStop'),
          crackManualHint: t('crackManualHint'),
        }}
        statusText={crackStatusText}
        reasonText={crackReasonText}
        showManualHint={crackPhase === 'manual' && crackProgress?.step === 0}
        hintReasonText={hintReasonText}
        onErase={() => fillDigit(0)}
        onUndo={() => gameRef.current?.undo()}
        onToggleNotes={() => gameRef.current?.toggleNotesMode()}
        onHint={applyHint}
        onCrackOpen={openCrackMenu}
        onCrackPrev={stepCrackBack}
        onCrackNext={stepCrack}
        onCrackStop={stopCrackDemo}
      />

      <DigitPad
        digitCounts={digitCounts}
        hideUsedDigits={settings.hideUsedDigits}
        selectDigitFirst={settings.selectDigitFirst}
        lockedDigit={lockedDigit}
        inputLocked={inputLocked}
        won={state.status === 'won'}
        onDigitClick={onDigitPadClick}
      />

      {state.paused && state.status === 'playing' && !settingsOpen ? (
        <PauseOverlay
          pausedLabel={t('paused')}
          resumeLabel={t('resume')}
          onResume={() => gameRef.current?.resume()}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          showCrack={crackEnabled && state.status === 'playing'}
          labels={buildSettingsPanelLabels(t)}
          onChange={setSetting}
          onReset={resetLevel}
          onLevelSelect={backToLevels}
          onBackDifficulty={backToDifficulty}
          onCrack={openCrackMenu}
          onClose={() => {
            setSettingsOpen(false)
            if (state.status === 'playing' && state.paused) gameRef.current?.resume()
          }}
        />
      ) : null}

      {crackMenuOpen ? (
        <CrackModeMenu
          title={t('crack')}
          instantLabel={t('crackModeInstant')}
          manualLabel={t('crackModeManual')}
          closeLabel={t('settingsClose')}
          onPick={pickCrackMode}
          onClose={() => setCrackMenuOpen(false)}
        />
      ) : null}

      {(state.status === 'won' || state.status === 'lost') && !resultDismissed ? (
        <WinDialog
          mode={state.status}
          elapsed={state.elapsed}
          bestTime={
            difficulty != null && levelId != null
              ? (progressLevels[progressKey(difficulty, levelId)]?.bestTime ?? null)
              : null
          }
          hasNextLevel={hasNext && state.status === 'won'}
          formatTime={formatElapsed}
          labels={{
            won: t('won'),
            lost: t('lost'),
            wonHint: t('wonHint'),
            lostHint: t('lostHint'),
            time: t('time'),
            bestTime: t('bestTime'),
            playAgain: t('playAgain'),
            nextLevel: t('nextLevel'),
            levelSelect: t('levelSelect'),
            close: t('close'),
          }}
          onReset={resetLevel}
          onNextLevel={goNext}
          onLevelSelect={backToLevels}
          onClose={() => setResultDismissed(true)}
        />
      ) : null}
    </div>
  )
}
