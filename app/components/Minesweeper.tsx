'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Difficulty, type GameState, getInitialGameState, PRESETS, MinesweeperGame } from './minesweeper-game'

const CELL_SIZE = 22
const NUMBER_COLORS: Record<number, string> = {
  1: '#0000ff',
  2: '#008000',
  3: '#ff0000',
  4: '#000080',
  5: '#800000',
  6: '#008080',
  7: '#000000',
  8: '#808080',
}

export interface MinesweeperProps {
  /** 嵌入弹窗内时为 true，去掉全屏最小高度 */
  embedded?: boolean
}

export function Minesweeper({ embedded = false }: MinesweeperProps = {}) {
  const [difficulty, setDifficulty] = useState<Difficulty>('basic')
  const [customInputs, setCustomInputs] = useState({ rows: 32, cols: 32, mines: 250 })

  const [state, setState] = useState<GameState>(() => getInitialGameState(PRESETS.basic))
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [pressedCell, setPressedCell] = useState<{ row: number; col: number } | null>(null)

  const gameRef = useRef<MinesweeperGame | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (gameRef.current == null) {
      gameRef.current = new MinesweeperGame(PRESETS.basic, setState)
      setState(gameRef.current.getState())
    }
    return () => {
      gameRef.current?.destroy()
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    if (state.highlightCells.length === 0) return
    const t = window.setTimeout(() => gameRef.current?.clearHighlight(), 100)
    return () => window.clearTimeout(t)
  }, [state.highlightCells])

  const game = gameRef.current
  const boardRows = state.board.length
  const boardCols = state.board[0]?.length ?? 0
  const highlightSet = useMemo(
    () => new Set(state.highlightCells.map((p) => `${p.row},${p.col}`)),
    [state.highlightCells],
  )

  const applyPreset = useCallback((d: Difficulty) => {
    setDifficulty(d)
    if (d !== 'custom' && gameRef.current) {
      const { rows: r, cols: c, mines: m } = PRESETS[d]
      gameRef.current.setDimensions(r, c, m)
    }
  }, [])

  const applyCustom = useCallback(() => {
    const r = Math.max(5, Math.min(50, customInputs.rows))
    const c = Math.max(5, Math.min(50, customInputs.cols))
    const maxMines = r * c - 9
    const m = Math.max(1, Math.min(maxMines, customInputs.mines))
    setCustomInputs((prev) => ({ ...prev, rows: r, cols: c, mines: m }))
    gameRef.current?.setDimensions(r, c, m)
  }, [customInputs.rows, customInputs.cols, customInputs.mines])

  const resetGame = useCallback(() => {
    gameRef.current?.reset()
    setHoveredCell(null)
    setPressedCell(null)
  }, [])

  const getCellFromEvent = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const col = Math.floor((e.clientX - rect.left) / CELL_SIZE)
      const row = Math.floor((e.clientY - rect.top) / CELL_SIZE)
      if (row >= 0 && row < boardRows && col >= 0 && col < boardCols) return { row, col }
      return null
    },
    [boardRows, boardCols],
  )

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return
      const pos = getCellFromEvent(e)
      if (pos) setPressedCell(pos)
    },
    [getCellFromEvent],
  )

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) {
        setPressedCell(null)
        return
      }
      const pos = getCellFromEvent(e)
      if (pos && pressedCell?.row === pos.row && pressedCell?.col === pos.col) {
        gameRef.current?.handleCellClick(pos.row, pos.col)
      }
      setPressedCell(null)
    },
    [getCellFromEvent, pressedCell],
  )

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const pos = getCellFromEvent(e)
      if (pos) gameRef.current?.handleRightClick(pos.row, pos.col)
    },
    [getCellFromEvent],
  )

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => setHoveredCell(getCellFromEvent(e)),
    [getCellFromEvent],
  )

  const handleCanvasMouseLeave = useCallback(() => {
    setHoveredCell(null)
    setPressedCell(null)
  }, [])

  const smileyIcon = () => {
    if (state.status === 'won') return '😎'
    if (state.status === 'lost') return '😵'
    return '🙂'
  }

  // ---------- Canvas 绘制 ----------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || boardRows === 0 || boardCols === 0) return

    const dpr = window.devicePixelRatio ?? 1
    const w = boardCols * CELL_SIZE
    const h = boardRows * CELL_SIZE
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    for (let r = 0; r < boardRows; r++) {
      for (let c = 0; c < boardCols; c++) {
        const cell = state.board[r][c]
        const x = c * CELL_SIZE
        const y = r * CELL_SIZE
        const revealed = cell.isRevealed
        const isHighlighted = highlightSet.has(`${r},${c}`)
        const isHovered = hoveredCell?.row === r && hoveredCell?.col === c
        const isPressed = pressedCell?.row === r && pressedCell?.col === c

        if (revealed) {
          ctx.fillStyle = '#bdbdbd'
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
          ctx.strokeStyle = '#808080'
          ctx.lineWidth = 1
          ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
        } else if (isHighlighted || isPressed) {
          ctx.fillStyle = '#a8a8a8'
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
          ctx.strokeStyle = '#808080'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x + 1, y + CELL_SIZE)
          ctx.lineTo(x + 1, y + 1)
          ctx.lineTo(x + CELL_SIZE, y + 1)
          ctx.stroke()
          ctx.strokeStyle = '#fff'
          ctx.beginPath()
          ctx.moveTo(x + CELL_SIZE - 1, y + 1)
          ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE - 1)
          ctx.lineTo(x + 1, y + CELL_SIZE - 1)
          ctx.stroke()
        } else {
          ctx.fillStyle = isHovered ? '#d0d0d0' : '#c0c0c0'
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x + 1, y + CELL_SIZE)
          ctx.lineTo(x + 1, y + 1)
          ctx.lineTo(x + CELL_SIZE, y + 1)
          ctx.stroke()
          ctx.strokeStyle = '#808080'
          ctx.beginPath()
          ctx.moveTo(x + CELL_SIZE - 1, y + 1)
          ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE - 1)
          ctx.lineTo(x + 1, y + CELL_SIZE - 1)
          ctx.stroke()
        }

        if (revealed) {
          if (cell.isMine) {
            const isExploded = state.explodedCell?.row === r && state.explodedCell?.col === c
            drawMine(ctx, x, y, isExploded)
          } else if (cell.adjacentMines > 0) {
            const color = NUMBER_COLORS[cell.adjacentMines] ?? '#000'
            const cx = x + CELL_SIZE / 2
            const cy = y + CELL_SIZE / 2
            const num = String(cell.adjacentMines)
            ctx.font = 'bold 14px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.strokeStyle = color
            ctx.lineWidth = 1
            ctx.strokeText(num, cx, cy)
            ctx.fillStyle = color
            ctx.fillText(num, cx, cy)
          }
        } else if (cell.isFlagged) {
          drawFlag(ctx, x, y)
        }
      }
    }
  }, [state.board, state.explodedCell, boardRows, boardCols, highlightSet, hoveredCell, pressedCell])

  return (
    <div className={`flex flex-col items-center text-[#000] p-4 ${embedded ? '' : 'min-h-screen'}`}>
      <div className='flex gap-0 mb-2 border border-[#808080] border-b-0 rounded-t overflow-hidden'>
        {(['basic', 'intermediate', 'expert', 'fullscreen', 'custom'] as const).map((d) => (
          <button
            key={d}
            type='button'
            onClick={() => applyPreset(d)}
            className={`px-4 py-1.5 text-sm border-r border-[#808080] last:border-r-0 ${
              difficulty === d ? 'bg-[#c0c0c0] font-medium' : 'bg-[#e0e0e0] hover:bg-[#d0d0d0]'
            }`}
          >
            {d === 'basic' && '基础'}
            {d === 'intermediate' && '中级'}
            {d === 'expert' && '专家'}
            {d === 'fullscreen' && '满屏'}
            {d === 'custom' && '自定义'}
          </button>
        ))}
      </div>

      {difficulty === 'custom' && (
        <div className='flex items-center gap-2 mb-3 px-3 py-2 bg-[#c0c0c0] border border-[#808080] border-t-0 rounded-b'>
          <label className='flex items-center gap-1 text-sm'>
            横
            <input
              type='number'
              // min={5}
              // max={50}
              value={customInputs.cols}
              onChange={(e) => setCustomInputs((p) => ({ ...p, cols: Number(e.target.value) }))}
              className='w-12 px-1 py-0.5 border border-[#808080] bg-white text-center text-sm'
            />
          </label>
          <label className='flex items-center gap-1 text-sm'>
            竖
            <input
              type='number'
              // min={5}
              // max={50}
              value={customInputs.rows}
              onChange={(e) => setCustomInputs((p) => ({ ...p, rows: Number(e.target.value) }))}
              className='w-12 px-1 py-0.5 border border-[#808080] bg-white text-center text-sm'
            />
          </label>
          <label className='flex items-center gap-1 text-sm'>
            雷
            <input
              type='number'
              // min={1}
              value={customInputs.mines}
              onChange={(e) => setCustomInputs((p) => ({ ...p, mines: Number(e.target.value) }))}
              className='w-14 px-1 py-0.5 border border-[#808080] bg-white text-center text-sm'
            />
          </label>
          <button
            type='button'
            onClick={applyCustom}
            className='px-3 py-1 border border-[#808080] bg-[#e0e0e0] text-sm hover:bg-[#d0d0d0]'
          >
            确定
          </button>
        </div>
      )}

      <div className='flex items-center justify-between w-full max-w-[100%] px-2 py-1.5 bg-[#c0c0c0] border-2 border-t-[#fff] border-l-[#fff] border-r-[#808080] border-b-[#808080] mb-1'>
        <div
          className='inline-flex items-center justify-end min-w-[4rem] h-7 px-1.5 rounded-sm tabular-nums text-[1.1rem] leading-none'
          style={{
            fontFamily: "'Seven Segmentiments', sans-serif",
            color: '#ff0a0a',
            backgroundColor: '#0d0d0d',
            border: '2px solid #9e9e9e',
            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)',
          }}
        >
          {String(state.remainingMines).padStart(3, '0')}
        </div>
        <button
          type='button'
          onClick={resetGame}
          className='w-9 h-9 flex items-center justify-center text-2xl border-2 border-t-[#808080] border-l-[#808080] border-r-[#fff] border-b-[#fff] bg-[#c0c0c0] hover:bg-[#d0d0d0] active:border-t-[#fff] active:border-l-[#fff] active:border-r-[#808080] active:border-b-[#808080]'
          title='重新开始'
        >
          {smileyIcon()}
        </button>
        <div
          className='inline-flex items-center justify-end min-w-[4rem] h-7 px-1.5 rounded-sm tabular-nums text-[1.1rem] leading-none'
          style={{
            fontFamily: "'Seven Segmentiments', sans-serif",
            color: '#ff0a0a',
            backgroundColor: '#0d0d0d',
            border: '2px solid #9e9e9e',
            boxShadow: 'inset 0 0 4px rgba(0,0,0,0.5)',
          }}
        >
          {String(state.elapsed).padStart(3, '0')}
        </div>
      </div>

      <div
        className='inline-block p-1 border-2 border-t-[#808080] border-l-[#808080] border-r-[#fff] border-b-[#fff] bg-[#c0c0c0] cursor-default'
        style={{ maxWidth: '100%', overflow: 'auto' }}
      >
        <canvas
          ref={canvasRef}
          width={boardCols * CELL_SIZE}
          height={boardRows * CELL_SIZE}
          className='block'
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleCanvasMouseUp}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          onContextMenu={handleCanvasContextMenu}
        />
      </div>

      <div className='mt-3 flex flex-col items-center gap-1'>
        <button
          type='button'
          onClick={() => game?.applyLogicStep()}
          className='px-3 py-1 text-sm border border-[#808080] bg-[#e0e0e0] hover:bg-[#d0d0d0] disabled:opacity-50 disabled:cursor-not-allowed'
          disabled={state.status !== 'playing'}
        >
          逻辑助手（无猜一步）
        </button>
        <p className='text-xs text-[#606060] max-w-md text-center'>{state.message}</p>
      </div>
    </div>
  )
}

function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number, isExploded: boolean): void {
  const cx = x + CELL_SIZE / 2
  const cy = y + CELL_SIZE / 2
  const radius = CELL_SIZE * 0.28
  const spikeLen = CELL_SIZE * 0.12
  const numSpikes = 12

  if (isExploded) {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
    ctx.strokeStyle = '#808080'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
  }

  ctx.fillStyle = '#000'
  for (let i = 0; i < numSpikes; i++) {
    const a = (i / numSpikes) * Math.PI * 2
    const ax = cx + (radius + spikeLen) * Math.cos(a)
    const ay = cy + (radius + spikeLen) * Math.sin(a)
    const a1 = a + 0.4
    const a2 = a - 0.4
    const bx = cx + radius * Math.cos(a1)
    const by = cy + radius * Math.sin(a1)
    const cpx = cx + radius * Math.cos(a2)
    const cpy = cy + radius * Math.sin(a2)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.lineTo(cpx, cpy)
    ctx.closePath()
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()

  const reflX = cx - radius * 0.3
  const reflY = cy - radius * 0.3
  const reflR = radius * 0.45
  const grad = ctx.createRadialGradient(reflX - reflR * 0.3, reflY - reflR * 0.3, 0, reflX, reflY, reflR)
  grad.addColorStop(0, 'rgba(255,255,255,0.5)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(reflX, reflY, reflR, 0, Math.PI * 2)
  ctx.fill()
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const baseX = x + CELL_SIZE * 0.65
  const baseY = y + CELL_SIZE * 0.75
  const topY = y + CELL_SIZE * 0.25
  const flagLeftX = x + CELL_SIZE * 0.2
  const flagMidY = y + CELL_SIZE * 0.35
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(baseX, baseY)
  ctx.lineTo(baseX, topY)
  ctx.stroke()
  ctx.fillStyle = '#ff0000'
  ctx.beginPath()
  ctx.moveTo(baseX, topY)
  ctx.lineTo(flagLeftX, flagMidY)
  ctx.lineTo(baseX, flagMidY + CELL_SIZE * 0.15)
  ctx.closePath()
  ctx.fill()
}
