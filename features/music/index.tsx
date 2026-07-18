'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  FolderPlus,
  Trash2,
  Music2,
  Search,
  Plus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'
import { Button, Input, Tab } from '@/components/ui'
import {
  DEMO_TRACKS,
  buildShuffleOrder,
  formatTime,
  toPlayableSrc,
  type RepeatMode,
  type Track,
} from './tracks'

export interface MusicProps {
  embedded?: boolean
}

type SearchHit = {
  id: string
  title: string
  artist: string
  source: string
  previewUrl: string
  artwork?: string
  durationHint?: number
}

export function Music({ embedded = false }: MusicProps = {}) {
  const t = useTranslations('music')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const seekDragging = useRef(false)
  const rafRef = useRef(0)
  const barsRef = useRef<HTMLCanvasElement>(null)
  const repeatRef = useRef<RepeatMode>('all')
  const goNextRef = useRef<(fromEnded?: boolean) => void>(() => {})
  const playingRef = useRef(false)

  const [tracks, setTracks] = useState<Track[]>(DEMO_TRACKS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('all')
  const [shuffle, setShuffle] = useState(false)
  const [shuffleOrder, setShuffleOrder] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hits, setHits] = useState<SearchHit[]>([])
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'playlist' | 'search'>('playlist')

  repeatRef.current = repeat
  playingRef.current = playing

  const current = tracks[currentIndex] ?? null

  const stopBars = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
  }, [])

  /** 不接管 MediaElement（避免 CORS / AudioContext 导致静音），仅做装饰频谱 */
  const drawBars = useCallback(() => {
    const canvas = barsRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let t = 0

    const paint = () => {
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barCount = 16
      const gap = 3
      const barW = (width - gap * (barCount - 1)) / barCount
      t += 0.08
      const active = playingRef.current
      for (let i = 0; i < barCount; i++) {
        const v = (0.25 + 0.55 * Math.abs(Math.sin(t + i * 0.45))) * (active ? 1 : 0.12)
        const h = Math.max(2, v * height)
        ctx.fillStyle = `rgba(245, 197, 66, ${0.35 + v * 0.65})`
        ctx.fillRect(i * (barW + gap), height - h, barW, h)
      }
      rafRef.current = requestAnimationFrame(paint)
    }

    stopBars()
    rafRef.current = requestAnimationFrame(paint)
  }, [stopBars])

  useEffect(() => {
    drawBars()
    return () => stopBars()
  }, [drawBars, stopBars])

  useEffect(() => {
    return () => {
      tracks.forEach((t) => {
        if (t.local) URL.revokeObjectURL(t.src)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    setError(null)
    setCurrentTime(0)
    setDuration(0)
    audio.src = current.src
    audio.load()
    if (playing) {
      void audio.play().catch(() => {
        setPlaying(false)
        setError('无法播放该曲目，可换一首或添加本地文件')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = muted ? 0 : volume
  }, [volume, muted])

  const resolveNextIndex = useCallback(
    (fromEnded: boolean) => {
      if (tracks.length === 0) return -1
      if (shuffle) {
        let order = shuffleOrder
        if (order.length !== tracks.length || !order.includes(currentIndex)) {
          order = buildShuffleOrder(tracks.length, currentIndex)
          setShuffleOrder(order)
        }
        const pos = order.indexOf(currentIndex)
        if (pos < order.length - 1) return order[pos + 1]!
        if (repeat === 'all' || !fromEnded) {
          const next = buildShuffleOrder(tracks.length, currentIndex)
          setShuffleOrder(next)
          return next[1] ?? next[0] ?? -1
        }
        return -1
      }
      if (currentIndex < tracks.length - 1) return currentIndex + 1
      if (repeat === 'all' || !fromEnded) return 0
      return -1
    },
    [tracks.length, shuffle, shuffleOrder, currentIndex, repeat],
  )

  const resolvePrevIndex = useCallback(() => {
    if (tracks.length === 0) return -1
    if (shuffle && shuffleOrder.length === tracks.length) {
      const pos = shuffleOrder.indexOf(currentIndex)
      if (pos > 0) return shuffleOrder[pos - 1]!
      return shuffleOrder[shuffleOrder.length - 1]!
    }
    return currentIndex > 0 ? currentIndex - 1 : tracks.length - 1
  }, [tracks.length, shuffle, shuffleOrder, currentIndex])

  const goNext = useCallback(
    (fromEnded = false) => {
      const next = resolveNextIndex(fromEnded)
      if (next < 0) {
        setPlaying(false)
        return
      }
      setCurrentIndex(next)
      setPlaying(true)
    },
    [resolveNextIndex],
  )
  goNextRef.current = goNext

  const goPrev = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const prev = resolvePrevIndex()
    if (prev < 0) return
    setCurrentIndex(prev)
    setPlaying(true)
  }, [resolvePrevIndex])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      if (!seekDragging.current) setCurrentTime(audio.currentTime)
    }
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0
        void audio.play()
        return
      }
      goNextRef.current(true)
    }
    const onError = () => setError('加载失败，请换一首或检查网络')

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !current) return
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setError('播放被阻止，请再点一次播放')
      }
    } else {
      audio.pause()
    }
  }, [current])

  const playAt = useCallback(
    async (index: number) => {
      if (index === currentIndex) {
        await togglePlay()
        return
      }
      setCurrentIndex(index)
      setPlaying(true)
    },
    [currentIndex, togglePlay],
  )

  const cycleRepeat = () => {
    setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
  }

  const toggleShuffle = () => {
    setShuffle((s) => {
      const next = !s
      if (next) setShuffleOrder(buildShuffleOrder(tracks.length, currentIndex))
      return next
    })
  }

  const onSeek = (value: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  const addLocalFiles = (files: FileList | null) => {
    if (!files?.length) return
    const added: Track[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
        continue
      }
      added.push({
        id: `local-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: t('local'),
        src: URL.createObjectURL(file),
        local: true,
        source: 'local',
      })
    }
    if (added.length === 0) return
    setTracks((prev) => [...prev, ...added])
    setTab('playlist')
  }

  const removeTrack = (id: string) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx < 0) return prev
      const track = prev[idx]!
      if (track.local) URL.revokeObjectURL(track.src)
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        setPlaying(false)
        setCurrentIndex(0)
        const audio = audioRef.current
        if (audio) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
        return next
      }
      if (idx === currentIndex) {
        setCurrentIndex(Math.min(idx, next.length - 1))
      } else if (idx < currentIndex) {
        setCurrentIndex((i) => i - 1)
      }
      return next
    })
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q) {
      setSearchError(t('needKeyword'))
      return
    }
    setSearching(true)
    setSearchError(null)
    setTab('search')
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}&rows=24`)
      const data = (await res.json()) as { results?: SearchHit[]; error?: string }
      if (!res.ok) {
        setHits([])
        setSearchError(data.error || t('searchFail'))
        return
      }
      setHits(data.results ?? [])
      if (!(data.results?.length)) {
        setSearchError(data.error || t('noResults'))
      }
    } catch {
      setHits([])
      setSearchError(t('networkError'))
    } finally {
      setSearching(false)
    }
  }

  const addSearchHit = async (hit: SearchHit, playNow: boolean) => {
    if (!hit.previewUrl) {
      setSearchError(t('noSource'))
      return
    }

    const trackId = `${hit.source || 'remote'}-${hit.id}`
    const existing = tracks.findIndex((t) => t.id === trackId)
    if (existing >= 0) {
      setTab('playlist')
      if (playNow) {
        setCurrentIndex(existing)
        setPlaying(true)
      }
      return
    }

    setResolvingId(hit.id)
    setSearchError(null)
    try {
      const track: Track = {
        id: trackId,
        title: hit.title,
        artist: hit.artist,
        src: toPlayableSrc(hit.previewUrl),
        durationHint: hit.durationHint,
        source: hit.source || 'audius',
      }
      setTracks((prev) => {
        if (playNow) {
          setCurrentIndex(prev.length)
          setPlaying(true)
        }
        return [...prev, track]
      })
      setTab('playlist')
    } finally {
      setResolvingId(null)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        void togglePlay()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        onSeek(Math.min(duration, currentTime + 5))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        onSeek(Math.max(0, currentTime - 5))
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        setVolume((v) => Math.min(1, v + 0.05))
        setMuted(false)
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        setVolume((v) => Math.max(0, v - 0.05))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const coverHue = useMemo(() => {
    if (!current) return 200
    let h = 0
    for (const c of current.id) h = (h + c.charCodeAt(0) * 17) % 360
    return h
  }, [current])

  return (
    <div
      className={cn(
        'min-h-0 flex flex-col text-sm text-[#e8e8e8] bg-[#1a1a1a] select-none',
        embedded ? '-m-3 h-[calc(100%+1.5rem)] min-h-[520px]' : 'min-h-screen',
      )}
    >
      <audio ref={audioRef} preload='metadata' />

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
              setCurrentTime(v)
              if (!seekDragging.current) onSeek(v)
            }}
            disabled={!current || !duration}
          />
          <span className='text-[10px] tabular-nums text-[#999] w-8'>{formatTime(duration)}</span>
        </div>

        {error && <p className='mt-1 text-[11px] text-[#ff8080]'>{error}</p>}

        <div className='mt-2 flex items-center justify-between gap-1'>
          <div className='flex items-center gap-0.5'>
            <ControlBtn label={t('shuffle')} active={shuffle} onClick={toggleShuffle}>
              <Shuffle size={14} />
            </ControlBtn>
            <ControlBtn label={t('prev')} onClick={goPrev}>
              <SkipBack size={16} />
            </ControlBtn>
            <Button
              size='icon-lg'
              className='rounded-sm mx-0.5'
              aria-label={playing ? t('pause') : t('play')}
              onClick={() => void togglePlay()}
              disabled={!current}
            >
              {playing ? <Pause size={18} /> : <Play size={18} className='ml-0.5' />}
            </Button>
            <ControlBtn label={t('next')} onClick={() => goNext(false)}>
              <SkipForward size={16} />
            </ControlBtn>
            <ControlBtn label={t('repeat')} active={repeat !== 'off'} onClick={cycleRepeat}>
              <RepeatIcon size={14} />
            </ControlBtn>
          </div>

          <div className='flex items-center gap-1 min-w-0'>
            <Button
              size='icon'
              aria-label={muted ? t('unmute') : t('mute')}
              onClick={() => setMuted((m) => !m)}
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
                setVolume(v)
                if (v > 0) setMuted(false)
              }}
            />
          </div>
        </div>

        {/* 搜索：Audius 完整曲 */}
        <form
          className='mt-2 flex gap-1'
          onSubmit={(e) => {
            e.preventDefault()
            void runSearch()
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
        <p className='mt-1 text-[10px] text-[#666] leading-snug'>
          {t('searchHint')}
        </p>
      </div>

      <div className='flex-1 min-h-0 flex flex-col'>
        <div className='shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-[#333] bg-[#222] gap-2'>
          <div className='flex items-center gap-1'>
            <Tab active={tab === 'playlist'} onClick={() => setTab('playlist')}>
              <ListMusic size={12} />
              {t('playlist', { count: tracks.length })}
            </Tab>
            <Tab active={tab === 'search'} onClick={() => setTab('search')}>
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
              addLocalFiles(e.target.files)
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
                  onClick={() => void playAt(index)}
                >
                  <span className='w-5 text-[10px] text-center tabular-nums text-[#888] shrink-0'>
                    {active && playing ? '♪' : index + 1}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-[12px] font-medium'>{track.title}</div>
                    <div className='truncate text-[10px] text-[#999]'>{track.artist}</div>
                  </div>
                  {track.source && (
                    <span className='text-[9px] px-1 rounded bg-[#444] text-[#ccc] shrink-0'>{track.source}</span>
                  )}
                  <button
                    type='button'
                    aria-label={t('remove')}
                    className='opacity-0 group-hover:opacity-100 p-1 text-[#aaa] hover:text-[#f88] shrink-0'
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTrack(track.id)
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
            {searchError && (
              <li className='px-3 py-3 text-[11px] text-[#ff8080]'>{searchError}</li>
            )}
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
                    onClick={() => void addSearchHit(hit, false)}
                    title={t('addToPlaylist')}
                  >
                    {!busy && <Plus size={11} />}
                  </Button>
                  <Button
                    size='sm'
                    className='px-1.5 text-[10px]'
                    disabled={busy}
                    onClick={() => void addSearchHit(hit, true)}
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
    </div>
  )
}

function ControlBtn({
  children,
  onClick,
  active,
  label,
}: {
  children: ReactNode
  onClick: () => void
  active?: boolean
  label: string
}) {
  return (
    <Button size='icon' aria-label={label} title={label} active={active} onClick={onClick}>
      {children}
    </Button>
  )
}
