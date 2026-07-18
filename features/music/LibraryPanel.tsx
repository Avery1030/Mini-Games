'use client'

import { type RefObject } from 'react'
import { FolderPlus, ListMusic, Play, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { Button, Tab } from '@/components/ui'
import type { RepeatMode, Track } from './tracks'

export type MusicTab = 'playlist' | 'search'

export type SearchHit = {
  id: string
  title: string
  artist: string
  source: string
  previewUrl: string
  artwork?: string
  durationHint?: number
}

export interface LibraryPanelProps {
  tab: MusicTab
  tracks: Track[]
  hits: SearchHit[]
  currentIndex: number
  playing: boolean
  searching: boolean
  searchError: string | null
  resolvingId: string | null
  repeat: RepeatMode
  shuffle: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onTabChange: (tab: MusicTab) => void
  onPlayAt: (index: number) => void
  onRemoveTrack: (id: string) => void
  onAddLocalFiles: (files: FileList | null) => void
  onAddSearchHit: (hit: SearchHit, playNow: boolean) => void
}

export function LibraryPanel({
  tab,
  tracks,
  hits,
  currentIndex,
  playing,
  searching,
  searchError,
  resolvingId,
  repeat,
  shuffle,
  fileInputRef,
  onTabChange,
  onPlayAt,
  onRemoveTrack,
  onAddLocalFiles,
  onAddSearchHit,
}: LibraryPanelProps) {
  const t = useTranslations('music')

  return (
    <>
      <div className='flex-1 min-h-0 flex flex-col'>
        <div className='shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-[#333] bg-[#222] gap-2'>
          <div className='flex items-center gap-1'>
            <Tab active={tab === 'playlist'} onClick={() => onTabChange('playlist')}>
              <ListMusic size={12} />
              {t('playlist', { count: tracks.length })}
            </Tab>
            <Tab active={tab === 'search'} onClick={() => onTabChange('search')}>
              <Search size={12} />
              {t('searchResults', { count: hits.length })}
            </Tab>
          </div>
          <Button size='sm' onClick={() => fileInputRef.current?.click()}>
            <FolderPlus size={12} />
            {t('local')}
          </Button>
          <input
            ref={fileInputRef}
            type='file'
            accept='audio/*,.mp3,.wav,.ogg,.m4a,.flac'
            multiple
            className='hidden'
            onChange={(e) => {
              onAddLocalFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {tab === 'playlist' ? (
          <ul className='flex-1 min-h-0 overflow-y-auto'>
            {tracks.length === 0 && (
              <li className='px-3 py-8 text-center text-[#777] text-xs'>{t('emptyList')}</li>
            )}
            {tracks.map((track, index) => {
              const active = index === currentIndex
              return (
                <li
                  key={track.id}
                  className={cn(
                    'group flex items-center gap-2 px-2 py-1.5 border-b border-[#2a2a2a] cursor-pointer',
                    active ? 'bg-[#000080]/70 text-white' : 'hover:bg-[#2c2c2c]',
                  )}
                  onClick={() => void onPlayAt(index)}
                >
                  <span className='w-5 text-[10px] text-center tabular-nums text-[#888] shrink-0'>
                    {active && playing ? '♪' : index + 1}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-[12px] font-medium'>{track.title}</div>
                    <div className='truncate text-[10px] text-[#999]'>{track.artist}</div>
                  </div>
                  {track.source && (
                    <span className='text-[9px] px-1 rounded bg-[#444] text-[#ccc] shrink-0'>
                      {track.source}
                    </span>
                  )}
                  <button
                    type='button'
                    aria-label={t('remove')}
                    className='opacity-0 group-hover:opacity-100 p-1 text-[#aaa] hover:text-[#f88] shrink-0'
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveTrack(track.id)
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className='flex-1 min-h-0 overflow-y-auto'>
            {searchError && <li className='px-3 py-3 text-[11px] text-[#ff8080]'>{searchError}</li>}
            {!searching && !searchError && hits.length === 0 && (
              <li className='px-3 py-8 text-center text-[#777] text-xs'>{t('searchPrompt')}</li>
            )}
            {hits.map((hit) => {
              const busy = resolvingId === hit.id
              const mins = hit.durationHint
                ? `${Math.floor(hit.durationHint / 60)}:${String(Math.floor(hit.durationHint % 60)).padStart(2, '0')}`
                : null
              return (
                <li
                  key={hit.id}
                  className='flex items-center gap-2 px-2 py-1.5 border-b border-[#2a2a2a] hover:bg-[#2c2c2c]'
                >
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-[12px] font-medium'>{hit.title}</div>
                    <div className='truncate text-[10px] text-[#999]'>
                      {hit.artist}
                      {mins ? ` · ${mins}` : ''}
                    </div>
                  </div>
                  <Button
                    size='sm'
                    className='px-1.5 text-[10px]'
                    loading={busy}
                    disabled={busy}
                    onClick={() => void onAddSearchHit(hit, false)}
                    title={t('addToPlaylist')}
                  >
                    {!busy && <Plus size={11} />}
                  </Button>
                  <Button
                    size='sm'
                    className='px-1.5 text-[10px]'
                    disabled={busy}
                    onClick={() => void onAddSearchHit(hit, true)}
                    title={t('playNow')}
                  >
                    <Play size={11} />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className='shrink-0 px-2 py-1 text-[10px] text-[#666] border-t border-[#333] flex justify-between gap-2'>
        <span className='truncate'>{t('shortcuts')}</span>
        <span className='shrink-0'>
          {repeat === 'off' ? t('repeatOff') : repeat === 'all' ? t('repeatAll') : t('repeatOne')}
          {shuffle ? ` · ${t('shuffleOn')}` : ''}
        </span>
      </div>
    </>
  )
}
