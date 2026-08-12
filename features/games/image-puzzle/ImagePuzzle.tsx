'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, ImagePlus, RotateCcw, Shuffle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { winChrome, winChromePressed, winChromeSunken } from '@/lib/winChrome'
import { createDefaultPuzzleImage } from './defaultImage'
import {
  canMoveTile,
  changeSize,
  createInitialState,
  isMisplaced,
  reshuffle,
  tileHome,
  tryMove,
} from './game'
import { BLANK, PUZZLE_SIZES, type PuzzleSize, type PuzzleState } from './types'

export interface ImagePuzzleProps {
  /** 嵌入桌面窗口时为 true */
  embedded?: boolean
  /** 可选关闭回调（桌面窗口可用窗口壳关闭；独立页可传入） */
  onClose?: () => void
}

type ImageStatus = 'loading' | 'ready' | 'error'

const MOVE_MS = 180

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 滑动图片拼图：纯 DOM + 二维数组状态，无游戏引擎。
 */
export function ImagePuzzle({ embedded = false, onClose }: ImagePuzzleProps = {}) {
  const t = useTranslations('imagePuzzle')
  const [state, setState] = useState<PuzzleState>(() => createInitialState(3))
  const [imageSrc, setImageSrc] = useState('')
  const [imageStatus, setImageStatus] = useState<ImageStatus>('loading')
  const [imageError, setImageError] = useState<string | null>(null)
  const [boardPx, setBoardPx] = useState(280)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const boardHostRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const loadImage = useCallback((src: string) => {
    setImageStatus('loading')
    setImageError(null)
    const img = new Image()
    img.onload = () => {
      setImageSrc(src)
      setImageStatus('ready')
    }
    img.onerror = () => {
      setImageStatus('error')
      setImageError('loadFailed')
      setImageSrc('')
    }
    img.src = src
  }, [])

  // 内置默认图
  useEffect(() => {
    const src = createDefaultPuzzleImage()
    if (!src) {
      setImageStatus('error')
      setImageError('loadFailed')
      return
    }
    loadImage(src)
  }, [loadImage])

  // 拼图区自适应
  useEffect(() => {
    const host = boardHostRef.current
    if (!host) return

    const update = () => {
      const pad = 8
      const side = Math.floor(Math.min(host.clientWidth, host.clientHeight) - pad)
      if (side > 0) setBoardPx(Math.max(160, Math.min(side, 560)))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  // 计时：playing 时每秒刷新；卸载清理
  useEffect(() => {
    if (state.status !== 'playing' || state.startedAt == null) {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }
    timerRef.current = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [state.status, state.startedAt])

  useEffect(
    () => () => {
      clearObjectUrl()
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    },
    [clearObjectUrl],
  )

  const elapsedDisplay = (() => {
    if (state.status === 'won' && state.elapsedSec != null) return state.elapsedSec
    if (state.startedAt == null) return 0
    // tick 仅用于触发重渲染
    void tick
    return Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000))
  })()

  const tilePx = Math.floor(boardPx / state.size)
  const boardExact = tilePx * state.size

  const onTileClick = useCallback((row: number, col: number) => {
    setState((prev) => tryMove(prev, row, col))
  }, [])

  const onDifficulty = useCallback((size: PuzzleSize) => {
    setState(changeSize(size))
    setPreviewOpen(false)
  }, [])

  const onShuffle = useCallback(() => {
    setState((prev) => reshuffle(prev))
    setPreviewOpen(false)
  }, [])

  const onReset = useCallback(() => {
    clearObjectUrl()
    const src = createDefaultPuzzleImage()
    if (src) loadImage(src)
    setState(createInitialState(3))
    setPreviewOpen(false)
  }, [clearObjectUrl, loadImage])

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
      loadImage(url)
      setState((prev) => reshuffle(prev))
      setPreviewOpen(false)
    },
    [clearObjectUrl, loadImage],
  )

  const playAgain = useCallback(() => {
    setState((prev) => reshuffle(prev))
  }, [])

  return (
    <div
      className={cn(
        embeddedAppShell(embedded, 'relative flex flex-col bg-[#c0c0c0] text-black min-h-0'),
        'overflow-hidden h-full',
      )}
    >
      {/* 顶栏 */}
      <div className={cn(winChromeSunken, 'mx-2 mt-2 px-2 py-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs shrink-0')}>
        <span className='font-bold truncate'>{t('title')}</span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('moves')}: {state.moves}
        </span>
        <span className='text-black/70 whitespace-nowrap'>
          {t('time')}: {formatElapsed(elapsedDisplay)}
        </span>
        {onClose ? (
          <button type='button' className={cn(winChrome, 'ml-auto h-6 px-2 text-xs')} onClick={onClose}>
            {t('close')}
          </button>
        ) : null}
      </div>

      {/* 难度 */}
      <div className='shrink-0 px-2 pt-1.5 flex flex-wrap items-center gap-1.5'>
        <span className='text-[11px] text-black/60 mr-0.5'>{t('difficulty')}</span>
        {PUZZLE_SIZES.map((size) => {
          const active = state.size === size
          return (
            <button
              key={size}
              type='button'
              className={cn(active ? winChromePressed : winChrome, 'h-7 px-2 text-xs')}
              onClick={() => onDifficulty(size)}
              aria-pressed={active}
            >
              {size}×{size}
            </button>
          )
        })}
      </div>

      {/* 操作 */}
      <div className='shrink-0 px-2 pt-1.5 flex flex-wrap items-center gap-1.5'>
        <button type='button' className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')} onClick={onShuffle}>
          <Shuffle size={12} aria-hidden />
          {t('shuffle')}
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
        <button type='button' className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')} onClick={onReset}>
          <RotateCcw size={12} aria-hidden />
          {t('reset')}
        </button>
        <button type='button' className={cn(winChrome, 'h-7 px-2 inline-flex items-center gap-1 text-xs')} onClick={onPickFile}>
          <ImagePlus size={12} aria-hidden />
          {t('upload')}
        </button>
        <input
          ref={fileInputRef}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={onFileChange}
        />
      </div>

      {/* 棋盘 */}
      <div ref={boardHostRef} className='flex-1 min-h-0 flex items-center justify-center px-2 py-2 overflow-hidden'>
        {imageStatus === 'loading' ? (
          <p className='text-xs text-black/60'>{t('loading')}</p>
        ) : imageStatus === 'error' ? (
          <div className='text-center px-4'>
            <p className='text-xs text-red-800 mb-2'>{t(imageError === 'invalidType' ? 'invalidType' : 'loadFailed')}</p>
            <button type='button' className={cn(winChrome, 'h-7 px-2 text-xs')} onClick={onPickFile}>
              {t('upload')}
            </button>
          </div>
        ) : (
          <div
            className={cn(winChromeSunken, 'relative bg-[#808080] shrink-0')}
            style={{ width: boardExact, height: boardExact }}
            role='application'
            aria-label={t('boardLabel')}
          >
            {state.board.map((row, r) =>
              row.map((value, c) => {
                if (value === BLANK) {
                  return (
                    <div
                      key={`blank-${r}-${c}`}
                      className='absolute box-border bg-[#6e6e6e]'
                      style={{
                        width: tilePx,
                        height: tilePx,
                        left: c * tilePx,
                        top: r * tilePx,
                      }}
                      aria-hidden
                    />
                  )
                }

                const home = tileHome(value, state.size)
                const movable = state.status !== 'won' && canMoveTile(state.board, r, c)
                const misplaced = isMisplaced(state.board, r, c)

                return (
                  <button
                    key={`tile-${value}`}
                    type='button'
                    disabled={!movable}
                    onClick={() => onTileClick(r, c)}
                    className={cn(
                      'absolute box-border border border-[#404040] p-0 overflow-hidden',
                      'border-t-white/50 border-l-white/50 border-r-black/40 border-b-black/40',
                      movable ? 'cursor-pointer' : 'cursor-default',
                      misplaced && 'brightness-[0.92] saturate-[0.85] ring-1 ring-inset ring-amber-700/50',
                      !misplaced && 'ring-1 ring-inset ring-emerald-600/35',
                    )}
                    style={{
                      width: tilePx,
                      height: tilePx,
                      left: c * tilePx,
                      top: r * tilePx,
                      transition: `left ${MOVE_MS}ms ease, top ${MOVE_MS}ms ease`,
                      backgroundImage: `url(${imageSrc})`,
                      backgroundSize: `${boardExact}px ${boardExact}px`,
                      backgroundPosition: `-${home.col * tilePx}px -${home.row * tilePx}px`,
                    }}
                    aria-label={t('tileLabel', { n: value + 1 })}
                  />
                )
              }),
            )}
          </div>
        )}
      </div>

      <p className='shrink-0 px-2 pb-1.5 text-[10px] text-black/55 truncate'>{t('hint')}</p>

      {/* 预览原图 */}
      {previewOpen && imageStatus === 'ready' ? (
        <div
          className='absolute inset-0 z-40 flex items-center justify-center bg-black/40 p-4'
          onClick={() => setPreviewOpen(false)}
          role='presentation'
        >
          <div
            className={cn(winChrome, 'bg-[#c0c0c0] p-2 max-w-[90%] max-h-[90%] shadow-md')}
            onClick={(e) => e.stopPropagation()}
            role='dialog'
            aria-label={t('preview')}
          >
            <p className='text-xs font-bold mb-1.5 px-0.5'>{t('preview')}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt=''
              className={cn(winChromeSunken, 'block max-w-[min(420px,80vw)] max-h-[min(420px,60vh)] object-contain bg-[#808080]')}
            />
            <div className='mt-2 flex justify-end'>
              <button type='button' className={cn(winChrome, 'h-7 px-3 text-xs')} onClick={() => setPreviewOpen(false)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 通关 */}
      {state.status === 'won' ? (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4'>
          <div className={cn(winChrome, 'bg-[#c0c0c0] px-5 py-4 min-w-[220px] text-center shadow-md')}>
            <p className='text-base font-bold mb-1 text-green-800'>{t('won')}</p>
            <p className='text-xs text-black/70 mb-1'>{t('wonHint')}</p>
            <p className='text-xs text-black/70 mb-3'>
              {t('moves')}: {state.moves} · {t('time')}: {formatElapsed(state.elapsedSec ?? elapsedDisplay)}
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
