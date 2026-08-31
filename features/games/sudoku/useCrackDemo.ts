import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import { buildCrackPath, ENABLE_CRACK_DEMO } from './solver'
import type { SudokuGame } from './sudoku-game'
import type { CrackMode, CrackStep } from './types'

export type CrackPhase = 'idle' | 'manual'

type Options = {
  gameRef: MutableRefObject<Nullable<SudokuGame>>
}

/** 破解通关：直接出答案，或手动逐步推导（附依据，可前进/后退） */
export function useCrackDemo({ gameRef }: Options) {
  const pathRef = useRef<CrackStep[]>([])
  const indexRef = useRef(0)
  const crackDemoRef = useRef(false)

  const [crackPhase, setCrackPhase] = useState<CrackPhase>('idle')
  const [crackProgress, setCrackProgress] = useState<Nullable<{ step: number; total: number }>>(null)
  const [lastStep, setLastStep] = useState<Nullable<CrackStep>>(null)
  const [crackError, setCrackError] = useState<Nullable<string>>(null)

  crackDemoRef.current = crackPhase === 'manual'

  const stopCrackDemo = useCallback(() => {
    pathRef.current = []
    indexRef.current = 0
    setCrackPhase('idle')
    setCrackProgress(null)
    setLastStep(null)
    setCrackError(null)
  }, [])

  const syncProgress = useCallback((idx: number) => {
    const path = pathRef.current
    indexRef.current = idx
    setCrackProgress({ step: idx, total: path.length })
    setLastStep(idx > 0 ? path[idx - 1]! : null)
  }, [])

  const startCrack = useCallback(
    (mode: CrackMode) => {
      if (!ENABLE_CRACK_DEMO) return
      const game = gameRef.current
      if (!game) return
      const state = game.getState()
      if (state.status === 'won') return

      setCrackError(null)
      setLastStep(null)

      if (mode === 'instant') {
        game.applyCrackSolution()
        stopCrackDemo()
        return
      }

      const path = buildCrackPath(game.getBoardGrid(), game.getSolution())
      if (path == null) {
        setCrackError('unsolvable')
        return
      }
      if (path.length === 0) {
        stopCrackDemo()
        return
      }

      pathRef.current = path
      indexRef.current = 0
      setCrackProgress({ step: 0, total: path.length })
      setCrackPhase('manual')
    },
    [gameRef, stopCrackDemo],
  )

  const stepCrack = useCallback(() => {
    if (crackPhase !== 'manual') return
    const path = pathRef.current
    const idx = indexRef.current
    const game = gameRef.current
    if (!game || idx >= path.length) return

    const step = path[idx]!
    game.applyCrackStep(step)
    syncProgress(idx + 1)
  }, [crackPhase, gameRef, syncProgress])

  const stepCrackBack = useCallback(() => {
    if (crackPhase !== 'manual') return
    const idx = indexRef.current
    const game = gameRef.current
    if (!game || idx <= 0) return
    if (!game.undoCrackStep()) return
    syncProgress(idx - 1)
  }, [crackPhase, gameRef, syncProgress])

  const canStepForward = crackPhase === 'manual' && (crackProgress?.step ?? 0) < (crackProgress?.total ?? 0)
  const canStepBack = crackPhase === 'manual' && (crackProgress?.step ?? 0) > 0

  return {
    enabled: ENABLE_CRACK_DEMO,
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
  }
}
