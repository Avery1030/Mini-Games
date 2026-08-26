import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useSudokuProgressStore } from './store'
import { getLevel, loadAllLevels } from './parseLevel'
import { SudokuGame } from './sudoku-game'
import type { Difficulty, SudokuState } from './types'
import { progressKey } from './types'

export type SudokuScreen = 'difficulty' | 'levels' | 'play'

const LEVEL_BUNDLE = loadAllLevels()

type Options = {
  gameRef: MutableRefObject<SudokuGame | null>
  stopCrackDemo: () => void
}

/** 难度/关卡/对局会话生命周期 */
export function useSudokuSession({ gameRef, stopCrackDemo }: Options) {
  const recordedWinKeyRef = useRef<string | null>(null)

  const [screen, setScreen] = useState<SudokuScreen>('difficulty')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [levelId, setLevelId] = useState<number | null>(null)
  const [state, setState] = useState<SudokuState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [crackMenuOpen, setCrackMenuOpen] = useState(false)

  const progressLevels = useSudokuProgressStore((s) => s.levels)
  const recordClear = useSudokuProgressStore((s) => s.recordClear)
  const isUnlocked = useSudokuProgressStore((s) => s.isUnlocked)

  const catalog = useMemo(() => (difficulty ? LEVEL_BUNDLE.catalogs[difficulty] : []), [difficulty])

  const difficultyItems = useMemo(
    () =>
      (['easy', 'medium', 'hard', 'expert'] as const).map((d) => {
        const ids = LEVEL_BUNDLE.catalogs[d]
        let clearedCount = 0
        for (const id of ids) {
          if (progressLevels[progressKey(d, id)] != null) clearedCount++
        }
        return { difficulty: d, levelCount: ids.length, clearedCount }
      }),
    [progressLevels],
  )

  const levelSelectItems = useMemo(() => {
    if (!difficulty) return []
    return catalog.map((id, index) => {
      const prog = progressLevels[progressKey(difficulty, id)]
      const level = getLevel(LEVEL_BUNDLE, difficulty, id)
      return {
        id,
        index: index + 1,
        unlocked: isUnlocked(difficulty, catalog, id),
        bestTime: prog?.bestTime ?? null,
        clues: level?.clues ?? 0,
      }
    })
  }, [catalog, difficulty, isUnlocked, progressLevels])

  const destroyGame = useCallback(() => {
    stopCrackDemo()
    setCrackMenuOpen(false)
    gameRef.current?.destroy()
    gameRef.current = null
  }, [gameRef, stopCrackDemo])

  const pickDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setScreen('levels')
  }, [])

  const backToLevels = useCallback(() => {
    destroyGame()
    setSettingsOpen(false)
    setScreen('levels')
    setLevelId(null)
    setState(null)
    recordedWinKeyRef.current = null
  }, [destroyGame])

  const backToDifficulty = useCallback(() => {
    destroyGame()
    setSettingsOpen(false)
    setScreen('difficulty')
    setDifficulty(null)
    setLevelId(null)
    setState(null)
    recordedWinKeyRef.current = null
  }, [destroyGame])

  const startLevel = useCallback(
    (id: number, opts?: { bypassUnlock?: boolean; diff?: Difficulty }) => {
      const d = opts?.diff ?? difficulty
      if (!d) return
      const level = getLevel(LEVEL_BUNDLE, d, id)
      if (!level) return
      const cat = LEVEL_BUNDLE.catalogs[d]
      if (!opts?.bypassUnlock && !isUnlocked(d, cat, id)) return
      destroyGame()
      recordedWinKeyRef.current = null
      setDifficulty(d)
      setLevelId(id)
      setScreen('play')
      gameRef.current = new SudokuGame(level, setState)
      setState(gameRef.current.getState())
    },
    [destroyGame, difficulty, gameRef, isUnlocked],
  )

  const resetLevel = useCallback(() => {
    if (!levelId || !difficulty) return
    const level = getLevel(LEVEL_BUNDLE, difficulty, levelId)
    if (!level || !gameRef.current) return
    stopCrackDemo()
    setSettingsOpen(false)
    setCrackMenuOpen(false)
    recordedWinKeyRef.current = null
    gameRef.current.loadLevel(level)
  }, [difficulty, gameRef, levelId, stopCrackDemo])

  const goNext = useCallback(() => {
    if (levelId == null || !difficulty) return
    const cat = LEVEL_BUNDLE.catalogs[difficulty]
    const idx = cat.indexOf(levelId)
    const next = idx >= 0 ? cat[idx + 1] : undefined
    if (next != null) startLevel(next, { bypassUnlock: true, diff: difficulty })
  }, [difficulty, levelId, startLevel])

  useEffect(() => () => destroyGame(), [destroyGame])

  useEffect(() => {
    if (!state || state.status !== 'won' || levelId == null || !difficulty) return
    const key = `${difficulty}:${levelId}:${state.elapsed}:${state.moves}`
    if (recordedWinKeyRef.current === key) return
    recordedWinKeyRef.current = key
    recordClear(difficulty, levelId, state.elapsed)
  }, [state, levelId, difficulty, recordClear])

  return {
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
  }
}
