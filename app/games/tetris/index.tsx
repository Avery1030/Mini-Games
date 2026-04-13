'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createInitialState,
  getDropInterval,
  getRenderBoard,
  hardDrop,
  moveHorizontal,
  rotateCurrent,
  softDrop,
  TETROMINO_VALUE_MAP,
  tick,
  togglePause,
  type CellValue,
  type TetrominoType,
} from './tetris-game'

export interface TetrisProps {
  embedded?: boolean
}

const CELL = 24
const CELL_COLORS: Record<CellValue, string> = {
  0: '#111827',
  1: '#06b6d4',
  2: '#facc15',
  3: '#a855f7',
  4: '#22c55e',
  5: '#ef4444',
  6: '#3b82f6',
  7: '#f97316',
}

const PREVIEW_CELL = 16
const PREVIEW_SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
}

const TYPE_TO_CELL: Record<TetrominoType, CellValue> = TETROMINO_VALUE_MAP

function playTone(freq: number, duration = 0.08, type: OscillatorType = 'square', volume = 0.04): void {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return
  const ctx = new AudioCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = volume
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  osc.stop(ctx.currentTime + duration)
  window.setTimeout(() => {
    void ctx.close()
  }, Math.ceil(duration * 1000) + 20)
}

export function Tetris({ embedded = false }: TetrisProps = {}) {
  const [state, setState] = useState(createInitialState)
  const renderBoard = useMemo(() => getRenderBoard(state), [state])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [flashUntil, setFlashUntil] = useState(0)
  const [shakeUntil, setShakeUntil] = useState(0)
  const [animNow, setAnimNow] = useState(0)
  const prevLinesRef = useRef(state.lines)

  useEffect(() => {
    if (state.status !== 'playing') return
    const timer = window.setInterval(() => {
      setState((prev) => tick(prev))
    }, getDropInterval(state.level))
    return () => window.clearInterval(timer)
  }, [state.level, state.status])

  useEffect(() => {
    if (state.lines > prevLinesRef.current) {
      const cleared = state.lines - prevLinesRef.current
      setFlashUntil(Date.now() + 180)
      playTone(660, 0.06, 'triangle', 0.05)
      if (cleared >= 2) playTone(880, 0.08, 'triangle', 0.04)
      if (cleared >= 4) playTone(1046, 0.12, 'triangle', 0.04)
    }
    prevLinesRef.current = state.lines
  }, [state.lines])

  useEffect(() => {
    const endAt = Math.max(flashUntil, shakeUntil)
    if (Date.now() >= endAt) return
    const timer = window.setInterval(() => setAnimNow(Date.now()), 16)
    return () => window.clearInterval(timer)
  }, [flashUntil, shakeUntil])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = BOARD_WIDTH * CELL
    const height = BOARD_HEIGHT * CELL
    const dpr = window.devicePixelRatio ?? 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const now = animNow || Date.now()
    const shaking = now < shakeUntil
    const flashing = now < flashUntil
    const shakeX = shaking ? (Math.random() * 2 - 1) * 3 : 0
    const shakeY = shaking ? (Math.random() * 2 - 1) * 2 : 0

    ctx.save()
    ctx.clearRect(0, 0, width, height)
    ctx.translate(shakeX, shakeY)

    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        const cell = renderBoard[r][c]
        const x = c * CELL
        const y = r * CELL

        ctx.fillStyle = CELL_COLORS[cell]
        ctx.fillRect(x, y, CELL, CELL)
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)

        if (cell !== 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)'
          ctx.fillRect(x + 2, y + 2, CELL - 6, 4)
        }
      }
    }

    if (flashing) {
      const alpha = 0.24 + Math.sin((flashUntil - now) * 0.1) * 0.1
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.08, alpha)})`
      ctx.fillRect(0, 0, width, height)
    }
    ctx.restore()
  }, [renderBoard, flashUntil, shakeUntil, animNow])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (state.status === 'gameover') {
        if (e.key === 'Enter') setState(createInitialState())
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setState((prev) => moveHorizontal(prev, -1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setState((prev) => moveHorizontal(prev, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setState((prev) => rotateCurrent(prev))
        playTone(560, 0.06, 'square', 0.035)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setState((prev) => softDrop(prev))
      } else if (e.key === ' ') {
        e.preventDefault()
        setState((prev) => hardDrop(prev))
        setShakeUntil(Date.now() + 110)
        playTone(220, 0.08, 'sawtooth', 0.045)
        playTone(160, 0.1, 'sine', 0.03)
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setState((prev) => togglePause(prev))
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault()
        setState(createInitialState())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.status])

  return (
    <div className={`w-full h-full text-white bg-[#0f172a] p-4 ${embedded ? '' : 'min-h-screen'}`}>
      <div className='flex items-start gap-4 h-full'>
        <div className='bg-black/50 border-2 border-[#334155] p-1'>
          <canvas ref={canvasRef} className='block' />
        </div>

        <div className='min-w-[150px] text-sm space-y-3'>
          <div className='bg-black/40 border border-[#334155] px-3 py-2'>
            <p>分数: {state.score}</p>
            <p>消行: {state.lines}</p>
            <p>等级: {state.level}</p>
            <div className='mt-2'>
              <p className='mb-1'>下一个:</p>
              <div
                className='grid bg-black/50 border border-[#475569] p-1 w-fit'
                style={{
                  gridTemplateColumns: `repeat(4, ${PREVIEW_CELL}px)`,
                  gridTemplateRows: `repeat(4, ${PREVIEW_CELL}px)`,
                }}
              >
                {PREVIEW_SHAPES[state.nextType].flatMap((row, r) =>
                  row.map((cell, c) => (
                    <div
                      key={`next-${r}-${c}`}
                      className='border border-black/20'
                      style={{
                        width: PREVIEW_CELL,
                        height: PREVIEW_CELL,
                        backgroundColor: cell === 1 ? CELL_COLORS[TYPE_TO_CELL[state.nextType]] : CELL_COLORS[0],
                      }}
                    />
                  )),
                )}
              </div>
            </div>
          </div>
          <div className='bg-black/40 border border-[#334155] px-3 py-2 text-xs leading-5'>
            <p>←/→: 移动</p>
            <p>↑: 旋转</p>
            <p>↓: 软降</p>
            <p>空格: 速降</p>
            <p>P: 暂停</p>
            <p>R: 重新开始</p>
          </div>
          <button
            type='button'
            className='w-full px-3 py-2 border border-[#475569] bg-[#1e293b] hover:bg-[#334155]'
            onClick={() => setState(createInitialState())}
          >
            重新开始
          </button>
          {state.status === 'paused' && <p className='text-amber-300 text-sm'>已暂停（按 P 继续）</p>}
          {state.status === 'gameover' && <p className='text-red-300 text-sm'>游戏结束（按 Enter 或 R 重开）</p>}
        </div>
      </div>
    </div>
  )
}
