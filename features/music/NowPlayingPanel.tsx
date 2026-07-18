'use client'

import { type RefObject } from 'react'
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Search,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Input } from '@/components/ui'
import { formatTime, type RepeatMode, type Track } from './tracks'
import { ControlBtn } from './ControlBtn'

export interface NowPlayingPanelProps {
  current: Track | undefined
  coverHue: number
  barsRef: RefObject<HTMLCanvasElement | null>
  currentTime: number
  duration: number
  progress: number
  playing: boolean
  volume: number
  muted: boolean
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
  query: string
  searching: boolean
  seekDragging: RefObject<boolean>
  onSeek: (time: number) => void
  onTogglePlay: () => void
  onGoPrev: () => void
  onGoNext: () => void
  onToggleShuffle: () => void
  onCycleRepeat: () => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onQueryChange: (query: string) => void
  onSearch: () => void
  onCurrentTimePreview: (time: number) => void
}

export function NowPlayingPanel({
  current,
  coverHue,
  barsRef,
  currentTime,
  duration,
  progress,
  playing,
  volume,
  muted,
  shuffle,
  repeat,
  error,
  query,
  searching,
  seekDragging,
  onSeek,
  onTogglePlay,
  onGoPrev,
  onGoNext,
  onToggleShuffle,
  onCycleRepeat,
  onVolumeChange,
  onToggleMute,
  onQueryChange,
  onSearch,
  onCurrentTimePreview,
}: NowPlayingPanelProps) {
  const t = useTranslations('music')
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  return (
    <div className='shrink-0 px-3 pt-3 pb-2 border-b border-[#333]'>
      <div className='flex gap-3'>
        <div
          className='w-[72px] h-[72px] shrink-0 rounded flex items-center justify-center border border-[#555] shadow-inner'
          style={{
            background: `linear-gradient(145deg, hsl(${coverHue} 45% 28%), hsl(${(coverHue + 40) % 360} 50% 16%))`,
          }}
        >
          <Music2 size={28} className='text-white/80' />
        </div>
        <div className='min-w-0 flex-1 flex flex-col justify-center gap-0.5'>
          <div className='font-bold truncate text-[#f5c542]'>{current?.title ?? t('emptyPlaylist')}</div>
          <div className='text-xs text-[#aaa] truncate'>{current?.artist ?? '—'}</div>
          <canvas ref={barsRef} width={200} height={28} className='w-full h-7 mt-1 opacity-90' />
        </div>
      </div>

      <div className='mt-3 flex items-center gap-2'>
        <span className='text-[10px] tabular-nums text-[#999] w-8 text-right'>{formatTime(currentTime)}</span>
        <input
          type='range'
          min={0}
          max={duration || 0}
          step={0.1}
          value={Number.isFinite(currentTime) ? currentTime : 0}
          className='flex-1 h-1.5 accent-[#f5c542] cursor-pointer'
          aria-valuenow={progress}
          onPointerDown={() => {
            seekDragging.current = true
          }}
          onPointerUp={(e) => {
            seekDragging.current = false
            onSeek(Number((e.target as HTMLInputElement).value))
          }}
          onChange={(e) => {
            const v = Number(e.target.value)
            onCurrentTimePreview(v)
            if (!seekDragging.current) onSeek(v)
          }}
          disabled={!current || !duration}
        />
        <span className='text-[10px] tabular-nums text-[#999] w-8'>{formatTime(duration)}</span>
      </div>

      {error && <p className='mt-1 text-[11px] text-[#ff8080]'>{error}</p>}

      <div className='mt-2 flex items-center justify-between gap-1'>
        <div className='flex items-center gap-0.5'>
          <ControlBtn label={t('shuffle')} active={shuffle} onClick={onToggleShuffle}>
            <Shuffle size={14} />
          </ControlBtn>
          <ControlBtn label={t('prev')} onClick={onGoPrev}>
            <SkipBack size={16} />
          </ControlBtn>
          <Button
            size='icon-lg'
            className='rounded-sm mx-0.5'
            aria-label={playing ? t('pause') : t('play')}
            onClick={() => void onTogglePlay()}
            disabled={!current}
          >
            {playing ? <Pause size={18} /> : <Play size={18} className='ml-0.5' />}
          </Button>
          <ControlBtn label={t('next')} onClick={onGoNext}>
            <SkipForward size={16} />
          </ControlBtn>
          <ControlBtn label={t('repeat')} active={repeat !== 'off'} onClick={onCycleRepeat}>
            <RepeatIcon size={14} />
          </ControlBtn>
        </div>

        <div className='flex items-center gap-1 min-w-0'>
          <Button
            size='icon'
            aria-label={muted ? t('unmute') : t('mute')}
            onClick={onToggleMute}
          >
            {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </Button>
          <input
            type='range'
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            className='w-16 sm:w-20 h-1.5 accent-[#f5c542] cursor-pointer'
            onChange={(e) => {
              const v = Number(e.target.value)
              onVolumeChange(v)
            }}
          />
        </div>
      </div>

      <form
        className='mt-2 flex gap-1'
        onSubmit={(e) => {
          e.preventDefault()
          void onSearch()
        }}
      >
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          tone='dark'
          size='md'
          className='flex-1'
        />
        <Button type='submit' size='md' className='px-2' loading={searching} disabled={searching}>
          {!searching && <Search size={12} />}
          {t('search')}
        </Button>
      </form>
      <p className='mt-1 text-[10px] text-[#666] leading-snug'>{t('searchHint')}</p>
    </div>
  )
}
