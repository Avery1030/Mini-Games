import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { tryMove } from './game'
import { CRACK_STEP_MS, ENABLE_CRACK_DEMO, solveMinMoves } from './solver'
import type { Direction, SokobanState } from './types'

export type CrackPhase = 'idle' | 'playing' | 'paused'

type Options = {
  stateRef: MutableRefObject<Nullable<SokobanState>>
  setState: Dispatch<SetStateAction<Nullable<SokobanState>>>
  setHeldDir: Dispatch<SetStateAction<Nullable<Direction>>>
}

/** 破解通关演示：最短路径按步播放 */
export function useCrackDemo({ stateRef, setState, setHeldDir }: Options) {
  const crackPathRef = useRef<Direction[]>([])
  const crackIndexRef = useRef(0)
  const crackTimerRef = useRef(0)
  const crackDemoRef = useRef(false)

  const [crackPhase, setCrackPhase] = useState<CrackPhase>('idle')
  const [crackProgress, setCrackProgress] = useState<Nullable<{ step: number; total: number }>>(null)
  const [crackError, setCrackError] = useState<Nullable<string>>(null)

  crackDemoRef.current = crackPhase === 'playing' || crackPhase === 'paused'

  const clearCrackTimer = useCallback(() => {
    if (crackTimerRef.current) {
      window.clearTimeout(crackTimerRef.current)
      crackTimerRef.current = 0
    }
  }, [])

  const stopCrackDemo = useCallback(() => {
    clearCrackTimer()
    crackPathRef.current = []
    crackIndexRef.current = 0
    setCrackPhase('idle')
    setCrackProgress(null)
    setCrackError(null)
  }, [clearCrackTimer])

  const runCrackStepRef = useRef<() => void>(() => {})
  runCrackStepRef.current = () => {
    clearCrackTimer()
    const path = crackPathRef.current
    const idx = crackIndexRef.current
    if (idx >= path.length) {
      setCrackPhase('idle')
      setCrackProgress(null)
      return
    }

    const dir = path[idx]
    const cur = stateRef.current
    if (!cur || cur.won) {
      stopCrackDemo()
      return
    }
    const next = tryMove(cur, dir)
    crackIndexRef.current = idx + 1
    setCrackProgress({ step: idx + 1, total: path.length })
    setState(next)
    setHeldDir(dir)

    if (idx + 1 >= path.length || next.won) {
      crackTimerRef.current = window.setTimeout(() => {
        setHeldDir(null)
        setCrackPhase('idle')
        setCrackProgress(null)
      }, CRACK_STEP_MS) as unknown as number
      return
    }

    crackTimerRef.current = window.setTimeout(() => {
      setHeldDir(null)
      runCrackStepRef.current()
    }, CRACK_STEP_MS) as unknown as number
  }

  const startCrackDemo = useCallback(() => {
    if (!ENABLE_CRACK_DEMO) return
    const cur = stateRef.current
    if (!cur || cur.won) return
    setCrackError(null)
    const path = solveMinMoves(cur)
    if (path == null) {
      setCrackError('unsolvable')
      return
    }
    if (path.length === 0) {
      stopCrackDemo()
      return
    }
    clearCrackTimer()
    crackPathRef.current = path
    crackIndexRef.current = 0
    setCrackProgress({ step: 0, total: path.length })
    setCrackPhase('playing')
    runCrackStepRef.current()
  }, [clearCrackTimer, stateRef, stopCrackDemo])

  const pauseCrackDemo = useCallback(() => {
    clearCrackTimer()
    setHeldDir(null)
    setCrackPhase('paused')
  }, [clearCrackTimer, setHeldDir])

  const resumeCrackDemo = useCallback(() => {
    setCrackPhase('playing')
    runCrackStepRef.current()
  }, [])

  useEffect(() => () => clearCrackTimer(), [clearCrackTimer])

  return {
    enabled: ENABLE_CRACK_DEMO,
    crackPhase,
    crackProgress,
    crackError,
    crackDemoRef,
    startCrackDemo,
    pauseCrackDemo,
    resumeCrackDemo,
    stopCrackDemo,
  }
}
