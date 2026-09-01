'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import { Eye, ImagePlus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { createDefaultPuzzleImage } from '@/features/games/image-puzzle/defaultImage'
import { pointInPolygon, toAbsolutePoints } from './geometry'
import {
  applyNeighborSnap,
  generatePieces,
  isJigsawComplete,
  remapPiecesAfterResize,
  scatterPieces,
} from './generate'
import {
  JIGSAW_DIFFICULTY,
  type ImageLoadStatus,
  type JigsawDifficulty,
  type Piece,
} from './types'

export interface CanvasJigsawProps {
  onClose?: () => void
}

const SNAP_THRESHOLD = 22
const DIFFICULTIES: JigsawDifficulty[] = ['easy', 'medium', 'hard']

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function canvasPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / Math.max(1, rect.width)
  const scaleY = canvas.height / Math.max(1, rect.height)
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

function groupCount(pieces: readonly Piece[], groupId: string): number {
  let n = 0
  for (const p of pieces) if (p.groupId === groupId) n += 1
  return n
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  image: HTMLImageElement,
  imgDrawW: number,
  imgDrawH: number,
  boardOriginX: number,
  boardOriginY: number,
  dragging: boolean,
  joined: boolean,
): void {
  ctx.save()
  ctx.translate(piece.x, piece.y)

  if (dragging) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetX = 4
    ctx.shadowOffsetY = 4
  }

  ctx.beginPath()
  const pts = piece.points
  if (pts.length > 0) {
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
  }

  ctx.save()
  ctx.clip()
  ctx.drawImage(
    image,
    boardOriginX - piece.targetX,
    boardOriginY - piece.targetY,
    imgDrawW,
    imgDrawH,
  )
  ctx.restore()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  // 已合成大块：不描边，避免榫卯接缝；单块保留轮廓便于识别
  if (!joined) {
    ctx.strokeStyle = dragging ? '#1d4ed8' : 'rgba(0,0,0,0.45)'
    ctx.lineWidth = dragging ? 2 : 1.1
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 纯 Canvas 不规则拼图：邻块相对磁吸成组，大块可自由拖动。
 */
export function CanvasJigsaw({ onClose }: CanvasJigsawProps = {}) {
  const t = useTranslations('canvasJigsaw')

  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageRef = useRef<Nullable<HTMLImageElement>>(null)
  const piecesRef = useRef<Piece[]>([])
  const dragGroupIdRef = useRef<Nullable<string>>(null)
  const dragGrabRef = useRef({ pieceId: '', ox: 0, oy: 0 })
  const rafRef = useRef<Nullable<number>>(null)
  const objectUrlRef = useRef<Nullable<string>>(null)
  const timerRef = useRef<Nullable<number>>(null)

  const boardRef = useRef({ originX: 0, originY: 0, w: 0, h: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })

  const [difficulty, setDifficulty] = useState<JigsawDifficulty>('easy')
  const [imageStatus, setImageStatus] = useState<ImageLoadStatus>('loading')
  const [imageError, setImageError] = useState<Nullable<'loadFailed' | 'invalidType'>>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [moves, setMoves] = useState(0)
  const [startedAt, setStartedAt] = useState<Nullable<number>>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [won, setWon] = useState(false)
  const [wonElapsed, setWonElapsed] = useState(0)
  const startedAtRef = useRef<Nullable<number>>(null)

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const layoutBoard = useCallback((canvasW: number, canvasH: number, img: HTMLImageElement) => {
    const pad = 12
    const availW = Math.max(40, canvasW - pad * 2)
    const availH = Math.max(40, canvasH - pad * 2)
    const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight)
    const w = Math.floor(img.naturalWidth * scale)
    const h = Math.floor(img.naturalHeight * scale)
    const originX = Math.floor((canvasW - w) / 2)
    const originY = Math.floor((canvasH - h) / 2)
    boardRef.current = { originX, originY, w, h }
    return boardRef.current
  }, [])

  const rebuildPieces = useCallback(
    (img: HTMLImageElement, diff: JigsawDifficulty, canvasW: number, canvasH: number) => {
      const board = layoutBoard(canvasW, canvasH, img)
      const grid = JIGSAW_DIFFICULTY[diff]
      const generated = generatePieces(board.w, board.h, grid.cols, grid.rows, board.originX, board.originY)
      piecesRef.current = scatterPieces(generated, canvasW, canvasH)
      dragGroupIdRef.current = null
      startedAtRef.current = null
      setMoves(0)
      setStartedAt(null)
      setElapsedSec(0)
      setWon(false)
      setWonElapsed(0)
    },
    [layoutBoard],
  )

  const resizeCanvas = useCallback(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const w = Math.max(1, Math.floor(wrap.clientWidth))
    const h = Math.max(1, Math.floor(wrap.clientHeight))
    if (canvas.width === w && canvas.height === h && sizeRef.current.w === w) return

    const prevW = sizeRef.current.w || w
    const prevH = sizeRef.current.h || h
    canvas.width = w
    canvas.height = h
    sizeRef.current = { w, h }

    const img = imageRef.current
    if (!img || imageStatus !== 'ready') return

    const sx = w / Math.max(1, prevW)
    const sy = h / Math.max(1, prevH)
    const board = layoutBoard(w, h, img)
    const grid = JIGSAW_DIFFICULTY[difficulty]
    const fresh = generatePieces(board.w, board.h, grid.cols, grid.rows, board.originX, board.originY)
    piecesRef.current = remapPiecesAfterResize(piecesRef.current, fresh, sx, sy, w, h)
  }, [difficulty, imageStatus, layoutBoard])

  const loadImage = useCallback(
    (src: string, diff: JigsawDifficulty) => {
      setImageStatus('loading')
      setImageError(null)
      setPreviewOpen(false)
      setWon(false)

      const img = new Image()
      img.onload = () => {
        imageRef.current = img
        setPreviewSrc(src)
        setImageStatus('ready')
        const canvas = canvasRef.current
        const wrap = wrapRef.current
        const w = canvas?.width || wrap?.clientWidth || 400
        const h = canvas?.height || wrap?.clientHeight || 320
        if (canvas && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w
          canvas.height = h
          sizeRef.current = { w, h }
        }
        rebuildPieces(img, diff, w, h)
      }
      img.onerror = () => {
        imageRef.current = null
        piecesRef.current = []
        setImageStatus('error')
        setImageError('loadFailed')
      }
      img.src = src
    },
    [rebuildPieces],
  )

  useEffect(() => {
    const src = createDefaultPuzzleImage()
    if (!src) {
      setImageStatus('error')
      setImageError('loadFailed')
      return
    }
    loadImage(src, difficulty)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      resizeCanvas()
    })
    ro.observe(wrap)
    resizeCanvas()
    return () => ro.disconnect()
  }, [resizeCanvas])

  useEffect(() => {
    if (won || startedAt == null) {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    }, 1000)
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [startedAt, won])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true

    const frame = () => {
      if (!alive) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      ctx.fillStyle = '#7a9e8a'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      for (let y = 0; y < h; y += 8) {
        ctx.fillRect(0, y, w, 1)
      }

      const img = imageRef.current
      const board = boardRef.current
      if (img && imageStatus === 'ready' && board.w > 0) {
        const pieces = piecesRef.current
        const dragGid = dragGroupIdRef.current

        for (const piece of pieces) {
          if (dragGid && piece.groupId === dragGid) continue
          const joined = groupCount(pieces, piece.groupId) > 1
          drawPiece(ctx, piece, img, board.w, board.h, board.originX, board.originY, false, joined)
        }
        if (dragGid) {
          for (const piece of pieces) {
            if (piece.groupId !== dragGid) continue
            const joined = groupCount(pieces, piece.groupId) > 1
            drawPiece(ctx, piece, img, board.w, board.h, board.originX, board.originY, true, joined)
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(frame)
    }

    rafRef.current = window.requestAnimationFrame(frame)
    return () => {
      alive = false
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [imageStatus])

  useEffect(
    () => () => {
      clearObjectUrl()
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
      if (timerRef.current != null) window.clearInterval(timerRef.current)
    },
    [clearObjectUrl],
  )

  const pickTopPiece = useCallback((x: number, y: number): Nullable<Piece> => {
    const list = piecesRef.current
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]
      const abs = toAbsolutePoints(p.x, p.y, p.points)
      if (pointInPolygon(x, y, abs)) return p
    }
    return null
  }, [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (imageStatus !== 'ready') return
      const canvas = canvasRef.current
      if (!canvas) return
      const { x, y } = canvasPoint(canvas, e.clientX, e.clientY)
      const hit = pickTopPiece(x, y)
      if (!hit) return

      // 整组提到最上层
      const rest = piecesRef.current.filter((p) => p.groupId !== hit.groupId)
      const group = piecesRef.current.filter((p) => p.groupId === hit.groupId)
      piecesRef.current = [...rest, ...group]

      dragGroupIdRef.current = hit.groupId
      dragGrabRef.current = { pieceId: hit.id, ox: x - hit.x, oy: y - hit.y }
      canvas.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    [imageStatus, pickTopPiece],
  )

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const gid = dragGroupIdRef.current
    if (!gid) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { x, y } = canvasPoint(canvas, e.clientX, e.clientY)
    const grab = dragGrabRef.current
    const anchor = piecesRef.current.find((p) => p.id === grab.pieceId)
    if (!anchor) return

    const nextX = x - grab.ox
    const nextY = y - grab.oy
    const dx = nextX - anchor.x
    const dy = nextY - anchor.y

    piecesRef.current = piecesRef.current.map((p) =>
      p.groupId === gid
        ? {
            ...p,
            x: p.x + dx,
            y: p.y + dy,
          }
        : p,
    )
  }, [])

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const gid = dragGroupIdRef.current
    if (!gid) return
    dragGroupIdRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    setMoves((m) => m + 1)
    if (startedAtRef.current == null) {
      const now = Date.now()
      startedAtRef.current = now
      setStartedAt(now)
    }

    const next = applyNeighborSnap(piecesRef.current, gid, SNAP_THRESHOLD)
    piecesRef.current = next

    if (!won && isJigsawComplete(next)) {
      const end = Date.now()
      const start = startedAtRef.current ?? end
      const sec = Math.max(0, Math.floor((end - start) / 1000))
      setWonElapsed(sec)
      setElapsedSec(sec)
      setWon(true)
    }
  }, [won])

  const onDifficulty = useCallback(
    (diff: JigsawDifficulty) => {
      setDifficulty(diff)
      const img = imageRef.current
      const { w, h } = sizeRef.current
      if (img && w > 0 && h > 0 && imageStatus === 'ready') {
        rebuildPieces(img, diff, w, h)
      }
    },
    [imageStatus, rebuildPieces],
  )

  const onReset = useCallback(() => {
    clearObjectUrl()
    const src = createDefaultPuzzleImage()
    setDifficulty('easy')
    if (src) loadImage(src, 'easy')
  }, [clearObjectUrl, loadImage])

  const onShuffleSame = useCallback(() => {
    const img = imageRef.current
    const { w, h } = sizeRef.current
    if (img && w > 0 && h > 0) rebuildPieces(img, difficulty, w, h)
  }, [difficulty, rebuildPieces])

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setImageStatus('error')
        setImageError('invalidType')
        return
      }
      clearObjectUrl()
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      loadImage(url, difficulty)
    },
    [clearObjectUrl, difficulty, loadImage],
  )

  const playAgain = useCallback(() => {
    onShuffleSame()
  }, [onShuffleSame])

  return (
    <div
      className={cn(
        embeddedAppShell('relative flex flex-col bg-[#c0c0c0] text-black min-h-0'),
        'overflow-hidden h-full',
      )}
    >
      <div className={cn(winChromeSunken, 'mx-2 mt-2 px-2 py-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs shrink-0')}>
        <span className='font-bold truncate'>{t('title')}</span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('moves')}: {moves}
        </span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('time')}: {formatElapsed(won ? wonElapsed : elapsedSec)}
        </span>
        {onClose ? (
          <button type='button' className={cn(winChrome, 'ml-auto h-6 px-2 text-xs')} onClick={onClose}>
            {t('close')}
          </button>
        ) : null}
      </div>

      <div className='shrink-0 px-2 pt-1.5 flex flex-wrap items-center gap-1.5'>
        <span className='text-[11px] text-black/60'>{t('difficulty')}</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            type='button'
            className={cn(difficulty === d ? winChromePressed : winChrome, 'h-7 px-2 text-xs')}
            onClick={() => onDifficulty(d)}
            aria-pressed={difficulty === d}
          >
            {t(`diff_${d}`)}
          </button>
        ))}
      </div>

      <div className='shrink-0 px-2 pt-1.5 flex flex-wrap items-center gap-1.5'>
        <button type='button' className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')} onClick={onShuffleSame}>
          <RotateCcw size={12} aria-hidden />
          {t('reset')}
        </button>
        <button
          type='button'
          className={cn(previewOpen ? winChromePressed : winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')}
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={imageStatus !== 'ready'}
        >
          <Eye size={12} aria-hidden />
          {t('preview')}
        </button>
        <button type='button' className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')} onClick={onPickFile}>
          <ImagePlus size={12} aria-hidden />
          {t('upload')}
        </button>
        <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onReset}>
          {t('defaultImage')}
        </button>
        <input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={onFileChange} />
      </div>

      <div ref={wrapRef} className={cn(winChromeSunken, 'flex-1 min-h-0 m-2 relative overflow-hidden bg-[#6b8f7a]')}>
        {imageStatus === 'loading' ? (
          <p className='absolute inset-0 flex items-center justify-center text-xs text-black/70 z-10 pointer-events-none'>
            {t('loading')}
          </p>
        ) : null}
        {imageStatus === 'error' ? (
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 px-4'>
            <p className='text-xs text-red-900 text-center'>
              {t(imageError === 'invalidType' ? 'invalidType' : 'loadFailed')}
            </p>
            <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onPickFile}>
              {t('upload')}
            </button>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className='block w-full h-full touch-none cursor-pointer'
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label={t('boardLabel')}
        />
      </div>

      <p className='shrink-0 px-2 pb-1.5 text-[10px] text-black/55 truncate'>{t('hint')}</p>

      {previewOpen && imageStatus === 'ready' && previewSrc ? (
        <div
          className='absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4'
          onClick={() => setPreviewOpen(false)}
          role='presentation'
        >
          <div
            className={cn(winChrome, 'bg-[#c0c0c0] p-2 max-w-[90%] max-h-[90%] shadow-md')}
            onClick={(ev) => ev.stopPropagation()}
            role='dialog'
            aria-label={t('preview')}
          >
            <p className='text-xs font-bold mb-1.5'>{t('preview')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt=''
              className={cn(winChromeSunken, 'block max-w-[min(420px,80vw)] max-h-[min(420px,55vh)] object-contain bg-[#808080]')}
            />
            <div className='mt-2 flex justify-end'>
              <button type='button' className={cn(winChrome, 'h-7 px-3 text-xs')} onClick={() => setPreviewOpen(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {won ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4'>
          <div className={cn(winChrome, 'bg-[#c0c0c0] px-5 py-4 min-w-[220px] text-center shadow-md')}>
            <p className='text-base font-bold mb-1 text-green-800'>{t('won')}</p>
            <p className='text-xs text-black/70 mb-1'>{t('wonHint')}</p>
            <p className='text-xs text-black/70 mb-3'>
              {t('moves')}: {moves} · {t('time')}: {formatElapsed(wonElapsed)}
            </p>
            <div className='flex items-center justify-center gap-2'>
              <button type='button' className={cn(winChrome, 'px-3 py-1 text-sm')} onClick={playAgain}>
                {t('playAgain')}
              </button>
              {onClose ? (
                <button type='button' className={cn(winChrome, 'px-3 py-1 text-sm')} onClick={onClose}>
                  {t('close')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
